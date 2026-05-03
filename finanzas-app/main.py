import asyncio
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import auth, transactions, budgets, dashboard, goals, debts, reports, cards, profile, servicios, inversiones, promociones
import models  # SQLAlchemy declarative models must be imported to register table definitions

try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"DB init error: {e}")


def _migrate_db():
    """Agrega columnas nuevas a tablas existentes sin perder datos."""
    from sqlalchemy import text
    new_columns = [
        "ALTER TABLE servicios ADD COLUMN numero_cuenta TEXT DEFAULT ''",
        "ALTER TABLE servicios ADD COLUMN link_pago TEXT DEFAULT ''",
        "ALTER TABLE servicios ADD COLUMN monto_variable INTEGER DEFAULT 0",
        "ALTER TABLE inversiones ADD COLUMN notas_tesis TEXT DEFAULT ''",
        "ALTER TABLE inversiones ADD COLUMN ticker TEXT DEFAULT ''",
        # nuevas tablas se crean vía create_all; columnas extra de tablas existentes van aquí
    ]
    with engine.connect() as conn:
        for sql in new_columns:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # columna ya existe


try:
    _migrate_db()
except Exception as e:
    print(f"Migration error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Vercel es serverless — no hay procesos persistentes, se usa endpoint on-demand
    if not os.getenv("VERCEL"):
        task_svc = asyncio.create_task(servicios.check_vencimientos_loop())
        task_promo = asyncio.create_task(promociones.check_promo_loop())
    else:
        task_svc = task_promo = None
    yield
    for task in [task_svc, task_promo]:
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass


app = FastAPI(title="FinanzasApp", version="1.0.0", lifespan=lifespan)

_allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:8000").lstrip('﻿').strip().split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(transactions.router)
app.include_router(budgets.router)
app.include_router(dashboard.router)
app.include_router(goals.router)
app.include_router(debts.router)
app.include_router(reports.router)
app.include_router(cards.router)
app.include_router(profile.router)
app.include_router(servicios.router)
app.include_router(inversiones.router)
app.include_router(promociones.router)

# Categorías endpoint (sin auth, datos estáticos)
from fastapi import APIRouter
cats_router = APIRouter(prefix="/api/categories", tags=["categories"])

DEFAULT_CATEGORIES = [
    {"id": 1,  "name": "Sueldo",       "icon": "💼", "type": "income"},
    {"id": 2,  "name": "Freelance",    "icon": "💻", "type": "income"},
    {"id": 3,  "name": "Inversiones",  "icon": "📈", "type": "income"},
    {"id": 4,  "name": "Otros ingresos","icon": "💰", "type": "income"},
    {"id": 5,  "name": "Comida",       "icon": "🍔", "type": "expense"},
    {"id": 6,  "name": "Transporte",   "icon": "🚌", "type": "expense"},
    {"id": 7,  "name": "Vivienda",     "icon": "🏠", "type": "expense"},
    {"id": 8,  "name": "Salud",        "icon": "🏥", "type": "expense"},
    {"id": 9,  "name": "Educación",    "icon": "📚", "type": "expense"},
    {"id": 10, "name": "Entretenimiento","icon": "🎮", "type": "expense"},
    {"id": 11, "name": "Ropa",         "icon": "👕", "type": "expense"},
    {"id": 12, "name": "Ahorro",       "icon": "🏦", "type": "expense"},
    {"id": 13, "name": "Servicios",    "icon": "💡", "type": "expense"},
    {"id": 14, "name": "Otros gastos", "icon": "📦", "type": "expense"},
]

@cats_router.get("")
def get_categories():
    return DEFAULT_CATEGORIES

app.include_router(cats_router)


def seed_categories():
    from database import SessionLocal
    db = SessionLocal()
    try:
        if db.query(models.Category).count() == 0:
            for c in DEFAULT_CATEGORIES:
                db.add(models.Category(id=c["id"], name=c["name"], icon=c["icon"], type=c["type"]))
            db.commit()
    finally:
        db.close()

try:
    seed_categories()
except Exception as e:
    print(f"Seed error: {e}")

# Servir frontend estático (local y en Vercel via includeFiles)
_static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
if os.path.isdir(_static_dir):
    app.mount("/", StaticFiles(directory=_static_dir, html=True), name="static")


@app.exception_handler(404)
async def not_found(request, exc):
    return RedirectResponse(url="/login.html")
