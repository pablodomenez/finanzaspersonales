import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import auth, transactions, budgets, dashboard, goals, debts, reports, cards
import models  # SQLAlchemy declarative models must be imported to register table definitions

Base.metadata.create_all(bind=engine)

app = FastAPI(title="FinanzasApp", version="1.0.0")

_allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:8000").split(",")
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

seed_categories()

# Servir frontend estático
app.mount("/", StaticFiles(directory="static", html=True), name="static")


@app.exception_handler(404)
async def not_found(request, exc):
    return RedirectResponse(url="/login.html")
