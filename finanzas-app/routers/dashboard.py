import calendar
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, extract
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _six_month_windows(month: int, year: int) -> list[tuple[int, int]]:
    """Devuelve los últimos 6 meses como lista de (month, year), de más antiguo a más reciente."""
    result = []
    for i in range(5, -1, -1):
        m = month - i
        y = year
        while m <= 0:
            m += 12
            y -= 1
        result.append((m, y))
    return result


@router.get("/summary")
def summary(
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    now = datetime.utcnow()
    month = month or now.month
    year = year or now.year

    # Transacciones del mes actual con categoría cargada en una sola query
    transactions = (
        db.query(models.Transaction)
        .options(joinedload(models.Transaction.category))
        .filter(
            models.Transaction.user_id == current_user.id,
            extract("month", models.Transaction.date) == month,
            extract("year", models.Transaction.date) == year,
        )
        .all()
    )

    total_income = round(sum(t.amount for t in transactions if t.type == models.TransactionType.income), 2)
    total_expense = round(sum(t.amount for t in transactions if t.type == models.TransactionType.expense), 2)

    by_category: dict = {}
    for t in transactions:
        if t.type == models.TransactionType.expense:
            key = t.category_id
            if key not in by_category:
                by_category[key] = {"id": t.category.id, "name": t.category.name, "icon": t.category.icon, "amount": 0.0}
            by_category[key]["amount"] = round(by_category[key]["amount"] + t.amount, 2)

    # Evolución 6 meses: una sola query con OR en lugar de 6 queries separadas
    windows = _six_month_windows(month, year)
    trend_filter = or_(*[
        and_(
            extract("month", models.Transaction.date) == m,
            extract("year", models.Transaction.date) == y,
        )
        for m, y in windows
    ])
    trend_transactions = (
        db.query(models.Transaction)
        .filter(models.Transaction.user_id == current_user.id, trend_filter)
        .all()
    )

    trend_map: dict[tuple, dict] = {(m, y): {"month": m, "year": y, "income": 0.0, "expense": 0.0} for m, y in windows}
    for t in trend_transactions:
        key = (t.date.month, t.date.year)
        if key in trend_map:
            if t.type == models.TransactionType.income:
                trend_map[key]["income"] = round(trend_map[key]["income"] + t.amount, 2)
            else:
                trend_map[key]["expense"] = round(trend_map[key]["expense"] + t.amount, 2)

    # Daily trend for selected month
    days_in_month = calendar.monthrange(year, month)[1]
    daily_map = {d: {"day": d, "income": 0.0, "expense": 0.0} for d in range(1, days_in_month + 1)}
    for t in transactions:
        day = t.date.day
        if t.type == models.TransactionType.income:
            daily_map[day]["income"] = round(daily_map[day]["income"] + t.amount, 2)
        else:
            daily_map[day]["expense"] = round(daily_map[day]["expense"] + t.amount, 2)

    # Últimas 5 transacciones con categoría cargada en la misma query
    recent = (
        db.query(models.Transaction)
        .options(joinedload(models.Transaction.category))
        .filter(models.Transaction.user_id == current_user.id)
        .order_by(models.Transaction.date.desc())
        .limit(5)
        .all()
    )

    # Estimado mensual de servicios activos
    _freq_factor = {"mensual": 1.0, "bimestral": 0.5, "trimestral": 1/3, "semestral": 1/6, "anual": 1/12}
    servicios_activos = db.query(models.Servicio).filter(
        models.Servicio.user_id == current_user.id,
        models.Servicio.activo == True,
    ).all()
    servicios_mensual = round(
        sum(s.monto * _freq_factor.get(s.frecuencia, 1) for s in servicios_activos), 2
    )

    return {
        "month": month,
        "year": year,
        "total_income": total_income,
        "total_expense": total_expense,
        "balance": round(total_income - total_expense, 2),
        "servicios_mensual": servicios_mensual,
        "servicios_count": len(servicios_activos),
        "by_category": list(by_category.values()),
        "monthly_trend": list(trend_map.values()),
        "daily_trend": [daily_map[d] for d in range(1, days_in_month + 1)],
        "recent_transactions": [
            {
                "id": t.id,
                "amount": t.amount,
                "type": t.type,
                "description": t.description,
                "date": t.date.isoformat(),
                "category": {"name": t.category.name, "icon": t.category.icon},
            }
            for t in recent
        ],
    }
