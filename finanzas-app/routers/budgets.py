from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import extract, func
from pydantic import BaseModel, Field
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/api/budgets", tags=["budgets"])


class BudgetCreate(BaseModel):
    category_id: int
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2000, le=2100)
    limit_amount: float = Field(gt=0)


@router.get("")
def list_budgets(
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = (
        db.query(models.Budget)
        .options(joinedload(models.Budget.category))
        .filter(models.Budget.user_id == current_user.id)
    )
    if month:
        q = q.filter(models.Budget.month == month)
    if year:
        q = q.filter(models.Budget.year == year)
    budgets = q.all()

    if not budgets:
        return []

    # Una sola query agregada para todos los gastos del período — evita N+1
    spent_rows = (
        db.query(
            models.Transaction.category_id,
            func.sum(models.Transaction.amount).label("total"),
        )
        .filter(
            models.Transaction.user_id == current_user.id,
            models.Transaction.type == models.TransactionType.expense,
            models.Transaction.category_id.in_([b.category_id for b in budgets]),
            *([extract("month", models.Transaction.date) == month] if month else []),
            *([extract("year", models.Transaction.date) == year] if year else []),
        )
        .group_by(models.Transaction.category_id)
        .all()
    )
    spent_map = {row.category_id: float(row.total) for row in spent_rows}

    result = []
    for b in budgets:
        total_spent = spent_map.get(b.category_id, 0.0)
        pct = round((total_spent / b.limit_amount) * 100, 1) if b.limit_amount > 0 else 0
        result.append({
            "id": b.id,
            "category": {"id": b.category.id, "name": b.category.name, "icon": b.category.icon},
            "month": b.month,
            "year": b.year,
            "limit_amount": b.limit_amount,
            "spent": round(total_spent, 2),
            "percentage": pct,
        })
    return result


@router.post("", status_code=201)
def create_or_update_budget(
    data: BudgetCreate,
    response: Response,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    category = db.query(models.Category).filter(models.Category.id == data.category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    existing = db.query(models.Budget).filter(
        models.Budget.user_id == current_user.id,
        models.Budget.category_id == data.category_id,
        models.Budget.month == data.month,
        models.Budget.year == data.year,
    ).first()

    if existing:
        existing.limit_amount = data.limit_amount
        db.commit()
        db.refresh(existing)
        response.status_code = 200
        budget = existing
    else:
        budget = models.Budget(
            user_id=current_user.id,
            category_id=data.category_id,
            month=data.month,
            year=data.year,
            limit_amount=data.limit_amount,
        )
        db.add(budget)
        db.commit()
        db.refresh(budget)

    return {
        "id": budget.id,
        "category": {"id": budget.category.id, "name": budget.category.name, "icon": budget.category.icon},
        "month": budget.month,
        "year": budget.year,
        "limit_amount": budget.limit_amount,
    }


@router.delete("/{budget_id}", status_code=204)
def delete_budget(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    b = db.query(models.Budget).filter(
        models.Budget.id == budget_id,
        models.Budget.user_id == current_user.id,
    ).first()
    if not b:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    db.delete(b)
    db.commit()
