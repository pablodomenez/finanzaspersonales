# FinanzasApp — Guía para Claude

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Python 3.12 + FastAPI |
| Base de datos | SQLite (dev) / PostgreSQL via `DATABASE_URL` (prod) |
| ORM | SQLAlchemy 2.0 |
| Auth | JWT (python-jose) + bcrypt (passlib) — `bcrypt==4.0.1` fijado (incompatible con >=5) |
| Frontend | HTML + Tailwind CSS CDN + Vanilla JS |
| Gráficos | Chart.js CDN |
| Deploy | Railway / Render (`Procfile`: `web: uvicorn main:app`) |

## Levantar localmente

```bash
cd "C:\Users\pablo\Curso Claude\finanzas-app"
python -m uvicorn main:app --reload --port 8000
```

Abrir: http://localhost:8000

## Estructura

```
finanzas-app/
├── main.py              # Entry point: registra routers, sirve static, crea tablas
├── database.py          # Engine SQLAlchemy + get_db dependency
├── models.py            # Todos los modelos ORM
├── auth.py              # JWT utils, hash, get_current_user dependency
├── requirements.txt
├── Procfile
├── .env / .env.example
├── routers/
│   ├── auth.py          # POST /api/auth/register, /login, GET /me
│   ├── transactions.py  # CRUD /api/transactions
│   ├── budgets.py       # CRUD /api/budgets + % usado calculado
│   ├── dashboard.py     # GET /api/dashboard/summary
│   ├── goals.py         # CRUD /api/goals + POST /{id}/contribute
│   ├── debts.py         # CRUD /api/debts + PATCH /{id}/toggle-paid
│   ├── reports.py       # GET /api/reports/summary + /export/csv
│   └── cards.py         # CRUD /api/cards + /api/cards/expenses + GET /summary
└── static/
    ├── login.html / register.html
    ├── dashboard.html / transactions.html / budgets.html
    ├── goals.html / debts.html / cards.html / reports.html
    └── js/
        ├── api.js         # apiFetch wrapper, formatCurrency, initPageCommons, populateYearSelect
        ├── theme.js       # toggle claro/oscuro (localStorage)
        ├── sidebar.js     # inyecta sidebar dinámicamente con navegación completa
        ├── dashboard.js / transactions.js / budgets.js
        ├── goals.js / debts.js / cards.js / reports.js
```

## Modelos de base de datos

```
User            id, email, hashed_password, name, created_at
Category        id, name, icon, type  ← precargadas en seed_categories()
Transaction     id, user_id, category_id, amount, type, description, date
Budget          id, user_id, category_id, month, year, limit_amount
Goal            id, user_id, name, icon, target_amount, current_amount, deadline
Debt            id, user_id, person_name, description, amount, type(owe|owed), due_date, paid
CreditCard      id, user_id, name, bank, last_four, credit_limit, closing_day, due_day, color
CardExpense     id, user_id, card_id, description, total_amount, installments,
                first_payment_month, first_payment_year
```

Las tablas se crean automáticamente con `Base.metadata.create_all(bind=engine)` al iniciar.

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/auth/register | Registro, devuelve JWT |
| POST | /api/auth/login | Login, devuelve JWT |
| GET | /api/auth/me | Usuario autenticado |
| GET | /api/transactions | Lista filtrada por month/year/type |
| POST | /api/transactions | Crear |
| PUT | /api/transactions/{id} | Editar |
| DELETE | /api/transactions/{id} | Eliminar |
| GET | /api/budgets | Lista con % gastado calculado |
| POST | /api/budgets | Crear/actualizar |
| DELETE | /api/budgets/{id} | Eliminar |
| GET | /api/dashboard/summary | KPIs + gráficos mes |
| GET | /api/goals | Lista metas |
| POST | /api/goals | Crear meta |
| POST | /api/goals/{id}/contribute | Agregar ahorro |
| DELETE | /api/goals/{id} | Eliminar |
| GET | /api/debts | Lista deudas (filtro ?type=owe\|owed) |
| POST | /api/debts | Crear deuda |
| PATCH | /api/debts/{id}/toggle-paid | Marcar saldada/pendiente |
| DELETE | /api/debts/{id} | Eliminar |
| GET | /api/cards | Lista tarjetas |
| POST | /api/cards | Crear tarjeta |
| PUT | /api/cards/{id} | Editar tarjeta |
| DELETE | /api/cards/{id} | Eliminar tarjeta (cascada gastos) |
| GET | /api/cards/summary | Resumen mensual por tarjeta |
| POST | /api/cards/expenses | Agregar gasto con cuotas |
| DELETE | /api/cards/expenses/{id} | Eliminar gasto |
| GET | /api/reports/summary | Reporte anual |
| GET | /api/reports/export/csv | Exportar CSV |
| GET | /api/categories | Categorías predefinidas |

## Convenciones frontend

- Cada página HTML incluye: `api.js` → `sidebar.js` → `page.js` (en ese orden)
- `requireAuth()` al inicio de cada page.js — redirige a login si no hay token
- `initPageCommons()` setea mes/año actual y saludo del sidebar
- `apiFetch()` maneja JWT header y redirige a login en 401
- Modo oscuro: clase `dark` en `<html>`, guardado en localStorage
- Sidebar inyectado dinámicamente por `sidebar.js` (IIFE)
- Event delegation para botones dinámicos (no onclick inline en templates)

## Variables de entorno (.env)

```
SECRET_KEY=clave-secreta-larga
DATABASE_URL=sqlite:///./finanzas.db   # prod: postgres://...
ACCESS_TOKEN_EXPIRE_MINUTES=10080      # 7 días
ALLOWED_ORIGINS=http://localhost:8000  # prod: https://tu-dominio.com
```

## Notas importantes

- `bcrypt==4.0.1` fijado — passlib 1.7.4 es incompatible con bcrypt>=5
- Las categorías se precargan en `seed_categories()` en main.py (no tocar IDs 1-14)
- `CardExpense.installments`: lógica de cuotas activas se calcula en Python:
  `activa si 1 <= (año*12+mes) - (first_year*12+first_month) + 1 <= installments`
- El sidebar detecta la página activa por `window.location.pathname`
