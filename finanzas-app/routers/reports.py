import csv
import io
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import extract, func
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/api/reports", tags=["reports"])

MONTH_NAMES_ES = [
    "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]


def _collect_report_data(year: int, user_id: int, db: Session) -> dict:
    """Devuelve monthly + by_category + totales para el año dado."""
    rows = (
        db.query(
            extract("month", models.Transaction.date).label("month"),
            models.Transaction.type,
            func.sum(models.Transaction.amount).label("total"),
        )
        .filter(
            models.Transaction.user_id == user_id,
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

    cat_rows = (
        db.query(
            models.Transaction.category_id,
            func.sum(models.Transaction.amount).label("total"),
        )
        .filter(
            models.Transaction.user_id == user_id,
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
        "monthly": list(monthly.values()),
        "by_category": categories_data,
        "total_income": round(total_income, 2),
        "total_expense": round(total_expense, 2),
    }


@router.get("/summary")
def report_summary(
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    year = year or datetime.now(timezone.utc).year
    data = _collect_report_data(year, current_user.id, db)
    return {
        "year": year,
        "total_income": data["total_income"],
        "total_expense": data["total_expense"],
        "balance": round(data["total_income"] - data["total_expense"], 2),
        "monthly": data["monthly"],
        "by_category": data["by_category"],
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


@router.get("/export/pdf", summary="Exportar reporte anual en PDF")
def export_pdf(
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        from fpdf import FPDF
    except ImportError:
        from fastapi import HTTPException
        raise HTTPException(status_code=501, detail="fpdf2 no está instalado en el servidor")

    year = year or datetime.now(timezone.utc).year

    rd = _collect_report_data(year, current_user.id, db)
    monthly        = {m["month"]: m for m in rd["monthly"]}
    categories_data = [{"name": c["name"], "amount": c["amount"], "percentage": c["percentage"]} for c in rd["by_category"]]
    total_income   = rd["total_income"]
    total_expense  = rd["total_expense"]

    # ── Generar PDF ──────────────────────────────────────────────────────────
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Título
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(109, 40, 217)
    pdf.cell(0, 12, f"Reporte Financiero {year}", ln=True, align="C")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 6, f"Usuario: {current_user.name}  |  Generado: {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M')} UTC", ln=True, align="C")
    pdf.ln(4)

    # Resumen anual
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(30, 30, 30)
    pdf.cell(0, 8, "Resumen Anual", ln=True)
    pdf.set_draw_color(220, 220, 220)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(2)

    pdf.set_font("Helvetica", "", 11)
    col_w = 60
    pdf.set_fill_color(240, 253, 244)
    pdf.set_text_color(21, 128, 61)
    pdf.cell(col_w, 10, f"Total Ingresos: ${total_income:,.0f}", border=1, fill=True)
    pdf.set_fill_color(254, 242, 242)
    pdf.set_text_color(185, 28, 28)
    pdf.cell(col_w, 10, f"Total Gastos:   ${total_expense:,.0f}", border=1, fill=True)
    bal_color = (21, 128, 61) if total_income >= total_expense else (185, 28, 28)
    pdf.set_fill_color(238, 242, 255)
    pdf.set_text_color(*bal_color)
    pdf.cell(col_w, 10, f"Balance:        ${(total_income - total_expense):,.0f}", border=1, fill=True)
    pdf.ln(12)

    # Tabla mensual
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(30, 30, 30)
    pdf.cell(0, 8, "Detalle por Mes", ln=True)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(2)

    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(109, 40, 217)
    pdf.set_text_color(255, 255, 255)
    col = [45, 45, 45, 45]
    pdf.cell(col[0], 7, "Mes", border=1, fill=True, align="C")
    pdf.cell(col[1], 7, "Ingresos", border=1, fill=True, align="C")
    pdf.cell(col[2], 7, "Gastos", border=1, fill=True, align="C")
    pdf.cell(col[3], 7, "Balance", border=1, fill=True, align="C")
    pdf.ln()

    pdf.set_font("Helvetica", "", 9)
    for i, m_data in enumerate(monthly.values()):
        bal = m_data["balance"]
        pdf.set_fill_color(249, 249, 255) if i % 2 == 0 else pdf.set_fill_color(255, 255, 255)
        pdf.set_text_color(30, 30, 30)
        pdf.cell(col[0], 6, MONTH_NAMES_ES[m_data["month"]], border=1, fill=True)
        pdf.set_text_color(21, 128, 61)
        pdf.cell(col[1], 6, f"${m_data['income']:,.0f}", border=1, fill=True, align="R")
        pdf.set_text_color(185, 28, 28)
        pdf.cell(col[2], 6, f"${m_data['expense']:,.0f}", border=1, fill=True, align="R")
        pdf.set_text_color(21, 128, 61) if bal >= 0 else pdf.set_text_color(185, 28, 28)
        pdf.cell(col[3], 6, f"${bal:,.0f}", border=1, fill=True, align="R")
        pdf.ln()
    pdf.ln(6)

    # Gastos por categoría
    if categories_data:
        pdf.set_font("Helvetica", "B", 12)
        pdf.set_text_color(30, 30, 30)
        pdf.cell(0, 8, "Gastos por Categoria", ln=True)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(2)

        pdf.set_font("Helvetica", "B", 9)
        pdf.set_fill_color(109, 40, 217)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(80, 7, "Categoria", border=1, fill=True)
        pdf.cell(50, 7, "Monto", border=1, fill=True, align="C")
        pdf.cell(40, 7, "Porcentaje", border=1, fill=True, align="C")
        pdf.ln()

        pdf.set_font("Helvetica", "", 9)
        for i, c in enumerate(categories_data[:15]):
            pdf.set_fill_color(249, 249, 255) if i % 2 == 0 else pdf.set_fill_color(255, 255, 255)
            pdf.set_text_color(30, 30, 30)
            pdf.cell(80, 6, c["name"], border=1, fill=True)
            pdf.set_text_color(185, 28, 28)
            pdf.cell(50, 6, f"${c['amount']:,.0f}", border=1, fill=True, align="R")
            pdf.set_text_color(80, 80, 80)
            pdf.cell(40, 6, f"{c['percentage']}%", border=1, fill=True, align="C")
            pdf.ln()

    # Footer
    pdf.ln(8)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(150, 150, 150)
    pdf.cell(0, 5, "Generado por FinanzasApp — finanzas-app.vercel.app", align="C", ln=True)

    pdf_bytes = pdf.output()
    filename = f"reporte_finanzas_{year}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
