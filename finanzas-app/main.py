import asyncio
import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from limiter import limiter
from database import engine, Base, is_postgres
from routers import auth, transactions, budgets, dashboard, goals, debts, reports, cards, profile, servicios, inversiones, promociones, compartidos, decisiones, google_auth, feedback, cotizaciones, alquileres, notificaciones, prestamos, push, twofa, admin
import models  # SQLAlchemy declarative models must be imported to register table definitions

# ── Sentry ──────────────────────────────────────────────────────────────────────
_sentry_dsn = os.getenv("SENTRY_DSN", "")
if _sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
    sentry_sdk.init(
        dsn=_sentry_dsn,
        integrations=[FastApiIntegration(), SqlalchemyIntegration()],
        traces_sample_rate=0.2,
        environment=os.getenv("ENVIRONMENT", "production"),
    )

# ── Logging estructurado ────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}',
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("finanzas")

try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    logger.error("DB init error: %s", e)


def _migrate_db():
    """Agrega columnas nuevas a tablas existentes sin perder datos."""
    from sqlalchemy import text
    new_columns = [
        "ALTER TABLE servicios ADD COLUMN IF NOT EXISTS numero_cuenta TEXT DEFAULT ''",
        "ALTER TABLE servicios ADD COLUMN IF NOT EXISTS link_pago TEXT DEFAULT ''",
        "ALTER TABLE servicios ADD COLUMN IF NOT EXISTS monto_variable INTEGER DEFAULT 0",
        "ALTER TABLE inversiones ADD COLUMN IF NOT EXISTS notas_tesis TEXT DEFAULT ''",
        "ALTER TABLE inversiones ADD COLUMN IF NOT EXISTS ticker TEXT DEFAULT ''",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP",
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_method TEXT",
        "ALTER TABLE pagos_servicios ADD COLUMN IF NOT EXISTS forma_pago TEXT DEFAULT ''",
        "ALTER TABLE card_expenses ADD COLUMN IF NOT EXISTS expense_type TEXT DEFAULT 'cuota'",
        "ALTER TABLE card_expenses ADD COLUMN IF NOT EXISTS end_month INTEGER",
        "ALTER TABLE card_expenses ADD COLUMN IF NOT EXISTS end_year INTEGER",
        "ALTER TABLE shared_groups ADD COLUMN IF NOT EXISTS join_token TEXT",
        "ALTER TABLE shared_participants ADD COLUMN IF NOT EXISTS user_id INTEGER",
        "ALTER TABLE shared_expenses ADD COLUMN IF NOT EXISTS comprobante TEXT",
        "ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS cargos_mensuales REAL DEFAULT 0",
        "ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS numero_operacion TEXT DEFAULT ''",
        "ALTER TABLE pagos_prestamos ADD COLUMN IF NOT EXISTS cargos REAL DEFAULT 0",
        "ALTER TABLE pagos_prestamos ADD COLUMN IF NOT EXISTS capital_uva REAL",
        "ALTER TABLE pagos_prestamos ADD COLUMN IF NOT EXISTS interes_uva REAL",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1",
    ]
    new_categories = [
        (15, "Mascotas",          "🐾", "expense"),
        (16, "Tarjeta de crédito","💳", "expense"),
    ]
    extra_columns = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_done INTEGER DEFAULT 0",
        "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS nav_preferences TEXT",
    ]
    with engine.connect() as conn:
        for sql in new_columns + extra_columns:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                conn.rollback()  # evita que PostgreSQL aborte todas las queries siguientes
        if is_postgres:
            # hashed_password debe ser nullable para usuarios de Google OAuth
            try:
                conn.execute(text("ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL"))
                conn.commit()
            except Exception:
                conn.rollback()
            # Convertir columnas INTEGER a BOOLEAN para compatibilidad con el modelo SQLAlchemy
            for col in ("totp_enabled", "onboarding_done"):
                try:
                    conn.execute(text(f"ALTER TABLE users ALTER COLUMN {col} DROP DEFAULT"))
                    conn.execute(text(f"ALTER TABLE users ALTER COLUMN {col} TYPE BOOLEAN USING ({col} != 0)"))
                    conn.execute(text(f"ALTER TABLE users ALTER COLUMN {col} SET DEFAULT false"))
                    conn.commit()
                except Exception:
                    conn.rollback()
        for cat_id, name, icon, cat_type in new_categories:
            try:
                conn.execute(text(
                    "INSERT INTO categories (id, name, icon, type) VALUES (:id, :name, :icon, :type) ON CONFLICT (id) DO NOTHING"
                ), {"id": cat_id, "name": name, "icon": icon, "type": cat_type})
                conn.commit()
            except Exception:
                conn.rollback()


try:
    _migrate_db()
except Exception as e:
    logger.error("Migration error: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Vercel es serverless — no hay procesos persistentes, se usa endpoint on-demand
    if not os.getenv("VERCEL"):
        task_svc = asyncio.create_task(servicios.check_vencimientos_loop())
        task_promo = asyncio.create_task(promociones.check_promo_loop())
        task_alq = asyncio.create_task(alquileres.check_alquileres_loop())
        task_periodicas = asyncio.create_task(promociones.check_periodicas_loop())
        task_recordatorio = asyncio.create_task(push.check_recordatorio_loop())
    else:
        task_svc = task_promo = task_alq = task_periodicas = task_recordatorio = None
    yield
    for task in [task_svc, task_promo, task_alq, task_periodicas, task_recordatorio]:
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass


app = FastAPI(
    title="FinanzasApp",
    version="2.0.0",
    lifespan=lifespan,
    openapi_tags=[
        {"name": "auth", "description": "Autenticación y sesiones"},
        {"name": "2fa", "description": "Autenticación de dos factores (TOTP)"},
        {"name": "transactions", "description": "Transacciones de ingresos y gastos"},
        {"name": "dashboard", "description": "Resumen financiero y KPIs"},
        {"name": "budgets", "description": "Presupuestos por categoría"},
        {"name": "goals", "description": "Metas de ahorro"},
        {"name": "debts", "description": "Deudas"},
        {"name": "cards", "description": "Tarjetas de crédito y cuotas"},
        {"name": "reports", "description": "Reportes y exportaciones"},
        {"name": "inversiones", "description": "Portfolio de inversiones"},
        {"name": "servicios", "description": "Servicios recurrentes"},
        {"name": "prestamos", "description": "Préstamos y amortización"},
        {"name": "alquileres", "description": "Alquileres y actualizaciones"},
        {"name": "push", "description": "Notificaciones push (Web Push API)"},
    ],
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)

_allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:8000").lstrip('﻿').strip().split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.middleware("http")
async def request_logging(request: Request, call_next):
    import time
    start = time.time()
    response: Response = await call_next(request)
    duration = round((time.time() - start) * 1000, 1)
    if not request.url.path.startswith("/api/"):
        return response
    logger.info(
        '{"method":"%s","path":"%s","status":%d,"ms":%s}',
        request.method, request.url.path, response.status_code, duration,
    )
    return response


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https://api.coingecko.com; "
        "frame-ancestors 'none';"
    )
    return response

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
app.include_router(compartidos.router)
app.include_router(decisiones.router)
app.include_router(google_auth.router)
app.include_router(feedback.router)
app.include_router(cotizaciones.router)
app.include_router(alquileres.router)
app.include_router(notificaciones.router)
app.include_router(prestamos.router)
app.include_router(push.router)
app.include_router(twofa.router)
app.include_router(admin.router)

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
    {"id": 13, "name": "Servicios",         "icon": "💡", "type": "expense"},
    {"id": 14, "name": "Otros gastos",      "icon": "📦", "type": "expense"},
    {"id": 15, "name": "Mascotas",          "icon": "🐾", "type": "expense"},
    {"id": 16, "name": "Tarjeta de crédito","icon": "💳", "type": "expense"},
    {"id": 17, "name": "Combustible",      "icon": "⛽", "type": "expense"},
]

@cats_router.get("")
def get_categories():
    return DEFAULT_CATEGORIES

app.include_router(cats_router)


def seed_categories():
    from database import SessionLocal
    db = SessionLocal()
    try:
        existing_ids = {r.id for r in db.query(models.Category.id).all()}
        for c in DEFAULT_CATEGORIES:
            if c["id"] not in existing_ids:
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
