from collections import defaultdict
from datetime import datetime, date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, extract, func
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/api/decisiones", tags=["decisiones"])

MONTH_NAMES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
               "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]


def _prev_months(month: int, year: int, n: int) -> list[tuple[int, int]]:
    result = []
    m, y = month, year
    for _ in range(n):
        m -= 1
        if m == 0:
            m = 12
            y -= 1
        result.append((m, y))
    return result


@router.get("/insights")
def get_insights(
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    now = datetime.utcnow()
    month = month or now.month
    year = year or now.year
    today = now.date()

    # Transacciones del mes actual
    cur_txns = (
        db.query(models.Transaction)
        .options(joinedload(models.Transaction.category))
        .filter(
            models.Transaction.user_id == current_user.id,
            extract("month", models.Transaction.date) == month,
            extract("year", models.Transaction.date) == year,
        )
        .all()
    )

    cur_income = sum(t.amount for t in cur_txns if t.type == models.TransactionType.income)
    cur_expense = sum(t.amount for t in cur_txns if t.type == models.TransactionType.expense)
    cur_balance = cur_income - cur_expense

    cat_expense_cur: dict[str, float] = defaultdict(float)
    cat_icon_map: dict[str, str] = {}
    for t in cur_txns:
        if t.type == models.TransactionType.expense:
            cat_expense_cur[t.category.name] += t.amount
            cat_icon_map[t.category.name] = t.category.icon

    # Últimos 3 meses
    prev3 = _prev_months(month, year, 3)
    prev_filter = or_(*[
        and_(extract("month", models.Transaction.date) == m,
             extract("year", models.Transaction.date) == y)
        for m, y in prev3
    ])
    prev_txns = (
        db.query(models.Transaction)
        .options(joinedload(models.Transaction.category))
        .filter(models.Transaction.user_id == current_user.id, prev_filter)
        .all()
    )

    # Promedio por categoría en últimos 3 meses
    cat_monthly: dict[str, dict[tuple, float]] = defaultdict(lambda: defaultdict(float))
    for t in prev_txns:
        if t.type == models.TransactionType.expense:
            cat_monthly[t.category.name][(t.date.month, t.date.year)] += t.amount

    cat_avg_prev: dict[str, float] = {
        cat: sum(mv.values()) / 3 for cat, mv in cat_monthly.items()
    }

    # === Recomendaciones ===
    recomendaciones = []

    if cur_income > 0:
        savings_rate = cur_balance / cur_income
        if savings_rate < 0.10:
            potential = max(0, cur_income * 0.15 - max(cur_balance, 0))
            if potential > 0:
                recomendaciones.append({
                    "tipo": "ahorro",
                    "icono": "piggy-bank",
                    "color": "blue",
                    "titulo": "Margen de ahorro disponible",
                    "mensaje": f"Ajustando gastos variables podrías ahorrar ${potential:,.0f} adicionales este mes.",
                    "prioridad": 1,
                })
        elif savings_rate >= 0.20:
            invest_amount = cur_balance * 0.5
            recomendaciones.append({
                "tipo": "inversion",
                "icono": "trending-up",
                "color": "emerald",
                "titulo": "Estás en condiciones de invertir",
                "mensaje": f"Tu tasa de ahorro es del {savings_rate*100:.0f}%. Podrías destinar ${invest_amount:,.0f} a inversiones este mes.",
                "prioridad": 2,
            })

    for cat, cur_amount in cat_expense_cur.items():
        avg = cat_avg_prev.get(cat, 0)
        if avg > 0 and cur_amount > avg * 1.20:
            pct = ((cur_amount - avg) / avg) * 100
            recomendaciones.append({
                "tipo": "alerta",
                "icono": "alert-triangle",
                "color": "amber",
                "titulo": f"Gasto elevado en {cat}",
                "mensaje": f"{cat_icon_map.get(cat, '')} {cat} está un {pct:.0f}% sobre tu promedio de 3 meses (${avg:,.0f} → ${cur_amount:,.0f}).",
                "prioridad": 3,
            })

    # Alertas de presupuesto
    budgets = (
        db.query(models.Budget)
        .options(joinedload(models.Budget.category))
        .filter(
            models.Budget.user_id == current_user.id,
            models.Budget.month == month,
            models.Budget.year == year,
        )
        .all()
    )
    for b in budgets:
        cat_name = b.category.name if b.category else ""
        spent = cat_expense_cur.get(cat_name, 0)
        if b.limit_amount > 0 and spent >= b.limit_amount * 0.85:
            pct_used = (spent / b.limit_amount) * 100
            remaining = max(0, b.limit_amount - spent)
            recomendaciones.append({
                "tipo": "presupuesto",
                "icono": "wallet",
                "color": "red",
                "titulo": f"Presupuesto de {cat_name} al límite",
                "mensaje": f"Usaste el {pct_used:.0f}% ({b.category.icon if b.category else ''} {cat_name}). Quedan ${remaining:,.0f}.",
                "prioridad": 1,
            })

    if not recomendaciones:
        if cur_balance > 0:
            recomendaciones.append({
                "tipo": "positivo",
                "icono": "check-circle",
                "color": "emerald",
                "titulo": "¡Vas excelente este mes!",
                "mensaje": f"Balance positivo de ${cur_balance:,.0f}. Sin alertas activas. Seguí registrando tus movimientos.",
                "prioridad": 1,
            })
        else:
            recomendaciones.append({
                "tipo": "inicio",
                "icono": "lightbulb",
                "color": "blue",
                "titulo": "Empezá a registrar tus transacciones",
                "mensaje": "Cuantos más datos tengas, mejores recomendaciones podré darte.",
                "prioridad": 1,
            })

    recomendaciones.sort(key=lambda x: x["prioridad"])

    # === Streak de hábitos ===
    raw_dates = (
        db.query(func.date(models.Transaction.date))
        .filter(models.Transaction.user_id == current_user.id)
        .distinct()
        .all()
    )
    txn_date_set = set()
    for (d,) in raw_dates:
        if isinstance(d, str):
            txn_date_set.add(date.fromisoformat(d[:10]))
        elif isinstance(d, datetime):
            txn_date_set.add(d.date())
        elif isinstance(d, date):
            txn_date_set.add(d)

    def calc_streak(from_day: date) -> int:
        count = 0
        day = from_day
        while day in txn_date_set:
            count += 1
            day -= timedelta(days=1)
        return count

    registro_hoy = today in txn_date_set
    streak = calc_streak(today) if registro_hoy else calc_streak(today - timedelta(days=1))

    monday = today - timedelta(days=today.weekday())
    semana = [
        {"dia": ["L", "M", "M", "J", "V", "S", "D"][i],
         "registrado": (monday + timedelta(days=i)) in txn_date_set,
         "futuro": (monday + timedelta(days=i)) > today}
        for i in range(7)
    ]

    habitos = {
        "streak": streak,
        "total_dias": len(txn_date_set),
        "registro_hoy": registro_hoy,
        "semana": semana,
    }

    # === Gamificación ===
    puntos = len(txn_date_set) * 5
    logros_obtenidos = []

    if txn_date_set:
        logros_obtenidos.append({"icono": "🎉", "nombre": "Primer registro", "desc": "Registraste tu primera transacción"})
        puntos += 50

    if streak >= 7:
        logros_obtenidos.append({"icono": "🔥", "nombre": "Semana perfecta", "desc": "7 días seguidos registrando movimientos"})
        puntos += 100

    total_budgets = db.query(models.Budget).filter(models.Budget.user_id == current_user.id).count()
    if total_budgets >= 3:
        logros_obtenidos.append({"icono": "📋", "nombre": "Planificador", "desc": "Definiste 3 o más presupuestos"})
        puntos += 75

    goals_all = db.query(models.Goal).filter(models.Goal.user_id == current_user.id).all()
    if goals_all:
        logros_obtenidos.append({"icono": "🎯", "nombre": "Soñador con plan", "desc": "Creaste tu primera meta financiera"})
        puntos += 50

    goals_done = [g for g in goals_all if g.current_amount >= g.target_amount]
    if goals_done:
        logros_obtenidos.append({"icono": "🏆", "nombre": "Meta cumplida", "desc": f"Alcanzaste: {goals_done[0].name}"})
        puntos += 200

    inv_count = db.query(models.Inversion).filter(
        models.Inversion.user_id == current_user.id,
        models.Inversion.estado == "activo",
    ).count()
    if inv_count > 0:
        logros_obtenidos.append({"icono": "📈", "nombre": "Inversor", "desc": "Registraste tu primera inversión activa"})
        puntos += 150

    # Meses con balance positivo
    all_txns = db.query(models.Transaction).filter(models.Transaction.user_id == current_user.id).all()
    monthly_balance: dict[tuple, float] = defaultdict(float)
    for t in all_txns:
        key = (t.date.month, t.date.year)
        monthly_balance[key] += t.amount if t.type == models.TransactionType.income else -t.amount

    positive_months = [k for k, v in monthly_balance.items() if v > 0]
    if positive_months:
        logros_obtenidos.append({"icono": "💚", "nombre": "Primer mes ahorrando", "desc": "Balance positivo en al menos un mes"})
        puntos += 100

    if len(positive_months) >= 3:
        logros_obtenidos.append({"icono": "🌱", "nombre": "Hábito formado", "desc": "3 meses o más con balance positivo"})
        puntos += 150

    # Niveles
    NIVELES = [
        (0,   200,  1, "Principiante", "slate"),
        (200, 600,  2, "Organizado",   "blue"),
        (600, 1200, 3, "Inversor",     "emerald"),
    ]
    nivel_inicio, nivel_fin, nivel_num, nivel_nombre, nivel_color = NIVELES[-1]
    for inicio, fin, num, nombre, color in NIVELES:
        if puntos < fin:
            nivel_inicio, nivel_fin, nivel_num, nivel_nombre, nivel_color = inicio, fin, num, nombre, color
            break

    nivel_pct = min(100, int(((puntos - nivel_inicio) / (nivel_fin - nivel_inicio)) * 100))

    gamificacion = {
        "puntos": puntos,
        "nivel": nivel_nombre,
        "nivel_num": nivel_num,
        "nivel_color": nivel_color,
        "nivel_siguiente": nivel_fin,
        "nivel_pct": nivel_pct,
        "logros": logros_obtenidos,
    }

    # === Resumen del mes ===
    prev_month = _prev_months(month, year, 1)[0]
    prev1_txns = [t for t in prev_txns if (t.date.month, t.date.year) == prev_month]
    prev_income = sum(t.amount for t in prev1_txns if t.type == models.TransactionType.income)
    prev_expense = sum(t.amount for t in prev1_txns if t.type == models.TransactionType.expense)

    top_cat = max(cat_expense_cur.items(), key=lambda x: x[1]) if cat_expense_cur else None
    resumen = {
        "mes": MONTH_NAMES[month],
        "anio": year,
        "ingresos": round(cur_income, 2),
        "gastos": round(cur_expense, 2),
        "balance": round(cur_balance, 2),
        "tasa_ahorro": round((cur_balance / cur_income * 100), 1) if cur_income > 0 else 0,
        "top_categoria": {
            "nombre": top_cat[0],
            "monto": round(top_cat[1], 2),
            "icono": cat_icon_map.get(top_cat[0], ""),
        } if top_cat else None,
        "vs_mes_anterior": {
            "ingresos_delta": round(cur_income - prev_income, 2),
            "gastos_delta": round(cur_expense - prev_expense, 2),
        },
    }

    # === Patrones ===
    expense_txns = [t for t in (cur_txns + prev_txns) if t.type == models.TransactionType.expense]
    wd_spending: dict[int, float] = defaultdict(float)
    wd_count: dict[int, int] = defaultdict(int)
    for t in expense_txns:
        wd = t.date.weekday()
        wd_spending[wd] += t.amount
        wd_count[wd] += 1

    patrones = []
    if wd_spending:
        max_wd = max(wd_spending, key=wd_spending.get)
        avg_day = wd_spending[max_wd] / max(wd_count[max_wd], 1)
        patrones.append({
            "icono": "calendar",
            "mensaje": f"Gastás más los {DIAS_SEMANA[max_wd]} (promedio ${avg_day:,.0f} por día)",
        })

    if top_cat:
        pct_top = (top_cat[1] / cur_expense * 100) if cur_expense > 0 else 0
        patrones.append({
            "icono": "pie-chart",
            "mensaje": f"{cat_icon_map.get(top_cat[0], '')} {top_cat[0]} representa el {pct_top:.0f}% de tus gastos este mes",
        })

    # === Crecimiento últimos 6 meses ===
    last6 = list(reversed(_prev_months(month, year, 5))) + [(month, year)]
    growth_filter = or_(*[
        and_(extract("month", models.Transaction.date) == m,
             extract("year", models.Transaction.date) == y)
        for m, y in last6
    ])
    growth_txns = db.query(models.Transaction).filter(
        models.Transaction.user_id == current_user.id, growth_filter
    ).all()

    growth_map = {(m, y): {"mes": MONTH_NAMES[m][:3], "income": 0.0, "expense": 0.0} for m, y in last6}
    for t in growth_txns:
        key = (t.date.month, t.date.year)
        if key in growth_map:
            if t.type == models.TransactionType.income:
                growth_map[key]["income"] = round(growth_map[key]["income"] + t.amount, 2)
            else:
                growth_map[key]["expense"] = round(growth_map[key]["expense"] + t.amount, 2)

    crecimiento = [
        {**v, "balance": round(v["income"] - v["expense"], 2)}
        for v in growth_map.values()
    ]

    return {
        "recomendaciones": recomendaciones[:6],
        "habitos": habitos,
        "gamificacion": gamificacion,
        "resumen": resumen,
        "patrones": patrones,
        "crecimiento": crecimiento,
    }
