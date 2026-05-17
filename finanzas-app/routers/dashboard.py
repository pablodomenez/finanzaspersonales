import calendar
from datetime import datetime, date, timezone
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, extract, func
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _month_offset(month: int, year: int, offset: int) -> tuple[int, int]:
    """Devuelve (month, year) desplazado `offset` meses (positivo = futuro)."""
    m = month + offset
    y = year
    while m > 12:
        m -= 12
        y += 1
    while m <= 0:
        m += 12
        y -= 1
    return m, y


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
    now = datetime.now(timezone.utc).replace(tzinfo=None)
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

    # Daily trend for selected month — only up to today if it's the current month
    days_in_month = calendar.monthrange(year, month)[1]
    today = now.replace(tzinfo=None)
    if month == today.month and year == today.year:
        last_day = today.day
    else:
        last_day = days_in_month
    daily_map = {d: {"day": d, "income": 0.0, "expense": 0.0} for d in range(1, last_day + 1)}
    for t in transactions:
        day = t.date.day
        if day in daily_map:
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
        "daily_trend": [daily_map[d] for d in range(1, last_day + 1)],
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


@router.get("/networth", summary="Patrimonio neto del usuario")
def net_worth(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Calcula activos − pasivos para obtener el patrimonio neto actual."""
    uid = current_user.id

    # ── Activos ──────────────────────────────────────────────────────────────
    inversiones_total = db.query(func.sum(models.Inversion.valor_actual)).filter(
        models.Inversion.user_id == uid,
        models.Inversion.estado == "activo",
    ).scalar() or 0.0

    metas_total = db.query(func.sum(models.Goal.current_amount)).filter(
        models.Goal.user_id == uid,
    ).scalar() or 0.0

    # Saldo de deudas que me deben (owed)
    me_deben = db.query(func.sum(models.Debt.amount)).filter(
        models.Debt.user_id == uid,
        models.Debt.type == models.DebtType.owed,
        models.Debt.paid == False,
    ).scalar() or 0.0

    total_activos = round(inversiones_total + metas_total + me_deben, 2)

    # ── Pasivos ───────────────────────────────────────────────────────────────
    deudas_total = db.query(func.sum(models.Debt.amount)).filter(
        models.Debt.user_id == uid,
        models.Debt.type == models.DebtType.owe,
        models.Debt.paid == False,
    ).scalar() or 0.0

    # Saldo pendiente de préstamos (última cuota pendiente acumulada)
    prestamos_saldo = db.query(func.sum(models.PagoPrestamo.saldo_pendiente)).filter(
        models.PagoPrestamo.user_id == uid,
        models.PagoPrestamo.estado == "pendiente",
    ).scalar() or 0.0

    total_pasivos = round(deudas_total + prestamos_saldo, 2)

    return {
        "activos": total_activos,
        "pasivos": total_pasivos,
        "patrimonio_neto": round(total_activos - total_pasivos, 2),
        "detalle": {
            "inversiones": round(inversiones_total, 2),
            "metas_ahorro": round(metas_total, 2),
            "deudas_a_cobrar": round(me_deben, 2),
            "deudas_a_pagar": round(deudas_total, 2),
            "prestamos_pendientes": round(prestamos_saldo, 2),
        },
    }


@router.get("/proyecciones", summary="Proyecciones financieras a N meses")
def proyecciones(
    months: int = 6,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Proyecta ingresos, gastos y balance para los próximos N meses."""
    if months < 1 or months > 24:
        months = 6

    uid = current_user.id
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # ── Promedio histórico (últimos 3 meses) ──────────────────────────────────
    hist_windows = [_month_offset(now.month, now.year, -(i + 1)) for i in range(3)]
    hist_filter = or_(*[
        and_(
            extract("month", models.Transaction.date) == m,
            extract("year", models.Transaction.date) == y,
        )
        for m, y in hist_windows
    ])
    hist_rows = (
        db.query(models.Transaction.type, func.sum(models.Transaction.amount).label("total"))
        .filter(models.Transaction.user_id == uid, hist_filter)
        .group_by(models.Transaction.type)
        .all()
    )
    avg_income = avg_expense = 0.0
    for row in hist_rows:
        val = float(row.total or 0) / 3
        if row.type == models.TransactionType.income:
            avg_income = val
        else:
            avg_expense = val

    # ── Gastos fijos recurrentes del mes actual ────────────────────────────────
    freq_factor = {"mensual": 1.0, "bimestral": 0.5, "trimestral": 1/3, "semestral": 1/6, "anual": 1/12}
    servicios_mensual = sum(
        s.monto * freq_factor.get(s.frecuencia, 1.0)
        for s in db.query(models.Servicio).filter(
            models.Servicio.user_id == uid, models.Servicio.activo == True
        ).all()
    )

    # Cuotas activas de tarjetas (promedio mensual)
    cuotas_mensual = 0.0
    card_expenses = db.query(models.CardExpense).filter(models.CardExpense.user_id == uid).all()
    cur_abs = now.year * 12 + now.month
    for ce in card_expenses:
        first_abs = ce.first_payment_year * 12 + ce.first_payment_month
        cuota_num = cur_abs - first_abs + 1
        if 1 <= cuota_num <= ce.installments:
            monthly = ce.total_amount / max(ce.installments, 1)
            cuotas_mensual += monthly

    # Cuotas de préstamos pendientes
    prestamos_mensual = 0.0
    for prestamo in db.query(models.Prestamo).filter(
        models.Prestamo.user_id == uid, models.Prestamo.activo == True
    ).all():
        next_cuota = db.query(models.PagoPrestamo).filter(
            models.PagoPrestamo.prestamo_id == prestamo.id,
            models.PagoPrestamo.estado == "pendiente",
        ).order_by(models.PagoPrestamo.numero_cuota).first()
        if next_cuota:
            prestamos_mensual += next_cuota.monto_total

    fixed_expenses = round(servicios_mensual + cuotas_mensual + prestamos_mensual, 2)

    # ── Proyectar N meses ──────────────────────────────────────────────────────
    projected_income  = round(avg_income, 2)
    projected_expense = round(max(avg_expense, fixed_expenses), 2)

    resultado = []
    for i in range(1, months + 1):
        m, y = _month_offset(now.month, now.year, i)
        balance = round(projected_income - projected_expense, 2)
        resultado.append({
            "month": m,
            "year": y,
            "income": projected_income,
            "expense": projected_expense,
            "balance": balance,
            "fixed_costs": fixed_expenses,
        })

    return {
        "proyecciones": resultado,
        "base": {
            "avg_income_3m": round(avg_income, 2),
            "avg_expense_3m": round(avg_expense, 2),
            "fixed_costs_mensual": fixed_expenses,
        },
    }
