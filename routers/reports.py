import csv
import io
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import extract, func
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/summary")
def report_summary(
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    year = year or datetime.utcnow().year

    # Ingresos y gastos por mes para el año completo
    rows = (
        db.query(
            extract("month", models.Transaction.date).label("month"),
            models.Transaction.type,
            func.sum(models.Transaction.amount).label("total"),
        )
        .filter(
            models.Transaction.user_id == current_user.id,
            extract("year", models.Transaction.date) == year,
        )
        .group_by("month", models.Transaction.type)
        .all()
    )

    monthly: dict[int, dict] = {m: {"month": m, "income": 0.0, "expense": 0.0} for m in range(1, 13)}
    for row in rows:
        m = int(row.month)
        if row.type == models.TransactionType.income:
            monthly[m]["income"] = round(float(row.total), 2)
        else:
            monthly[m]["expense"] = round(float(row.total), 2)
    for m in monthly.values():
        m["balance"] = round(m["income"] - m["expense"], 2)

    # Gastos por categoría en el año
    cat_rows = (
        db.query(
            models.Transaction.category_id,
            func.sum(models.Transaction.amount).label("total"),
        )
        .filter(
            models.Transaction.user_id == current_user.id,
            models.Transaction.type == models.TransactionType.expense,
            extract("year", models.Transaction.date) == year,
        )
        .group_by(models.Transaction.category_id)
        .all()
    )
    cat_map = {r.category_id: float(r.total) for r in cat_rows}
    categories_data = []
    if cat_map:
        cats = db.query(models.Category).filter(models.Category.id.in_(list(cat_map.keys()))).all()
        total_exp = sum(cat_map.values())
        for c in sorted(cats, key=lambda x: cat_map[x.id], reverse=True):
            categories_data.append({
                "id": c.id, "name": c.name, "icon": c.icon,
                "amount": round(cat_map[c.id], 2),
                "percentage": round((cat_map[c.id] / total_exp) * 100, 1) if total_exp > 0 else 0,
            })

    total_income = sum(m["income"] for m in monthly.values())
    total_expense = sum(m["expense"] for m in monthly.values())

    return {
        "year": year,
        "total_income": round(total_income, 2),
        "total_expense": round(total_expense, 2),
        "balance": round(total_income - total_expense, 2),
        "monthly": list(monthly.values()),
        "by_category": categories_data,
    }


@router.get("/export/csv")
def export_csv(
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = (
        db.query(models.Transaction)
        .options(joinedload(models.Transaction.category))
        .filter(models.Transaction.user_id == current_user.id)
    )
    if year:
        q = q.filter(extract("year", models.Transaction.date) == year)
    if month:
        q = q.filter(extract("month", models.Transaction.date) == month)
    transactions = q.order_by(models.Transaction.date.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Fecha", "Tipo", "Categoría", "Descripción", "Monto"])
    for t in transactions:
        writer.writerow([
            t.date.strftime("%d/%m/%Y"),
            "Ingreso" if t.type == models.TransactionType.income else "Gasto",
            t.category.name,
            t.description or "",
            t.amount,
        ])

    output.seek(0)
    filename = f"finanzas_{year or 'all'}{'_' + str(month) if month else ''}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
