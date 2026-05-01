from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/api/cards", tags=["cards"])

CARD_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#ef4444", "#10b981", "#f59e0b", "#06b6d4", "#6366f1"]


class CardCreate(BaseModel):
    name: str = Field(min_length=1)
    bank: str = ""
    last_four: str = ""
    credit_limit: Optional[float] = None
    closing_day: Optional[int] = Field(None, ge=1, le=31)
    due_day: Optional[int] = Field(None, ge=1, le=31)
    color: str = "#3b82f6"


class ExpenseCreate(BaseModel):
    card_id: int
    description: str = Field(min_length=1)
    total_amount: float = Field(gt=0)
    installments: int = Field(default=1, ge=1, le=120)
    first_payment_month: int = Field(ge=1, le=12)
    first_payment_year: int = Field(ge=2020, le=2100)


def _serialize_card(c: models.CreditCard) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "bank": c.bank,
        "last_four": c.last_four,
        "credit_limit": c.credit_limit,
        "closing_day": c.closing_day,
        "due_day": c.due_day,
        "color": c.color,
    }


def _installment_info(e: models.CardExpense, month: int, year: int) -> dict:
    qm = year * 12 + month
    fm = e.first_payment_year * 12 + e.first_payment_month
    installment_number = qm - fm + 1
    remaining = e.installments - installment_number
    installment_amount = round(e.total_amount / e.installments, 2)
    return {
        "id": e.id,
        "card_id": e.card_id,
        "description": e.description,
        "total_amount": e.total_amount,
        "installments": e.installments,
        "installment_amount": installment_amount,
        "installment_number": installment_number,
        "remaining": remaining,
        "first_payment_month": e.first_payment_month,
        "first_payment_year": e.first_payment_year,
    }


def _is_active(e: models.CardExpense, month: int, year: int) -> bool:
    qm = year * 12 + month
    fm = e.first_payment_year * 12 + e.first_payment_month
    pos = qm - fm + 1
    return 1 <= pos <= e.installments


@router.get("/colors")
def get_colors():
    return CARD_COLORS


@router.get("/summary")
def card_summary(
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    now = datetime.utcnow()
    month = month or now.month
    year = year or now.year

    cards = (
        db.query(models.CreditCard)
        .filter(models.CreditCard.user_id == current_user.id)
        .order_by(models.CreditCard.created_at)
        .all()
    )
    all_expenses = (
        db.query(models.CardExpense)
        .filter(models.CardExpense.user_id == current_user.id)
        .all()
    )

    card_results = []
    grand_total = 0.0

    for card in cards:
        active = [e for e in all_expenses if e.card_id == card.id and _is_active(e, month, year)]
        monthly_total = round(sum(e.total_amount / e.installments for e in active), 2)
        grand_total += monthly_total
        card_results.append({
            **_serialize_card(card),
            "monthly_total": monthly_total,
            "expense_count": len(active),
            "expenses": [_installment_info(e, month, year) for e in active],
        })

    return {
        "month": month,
        "year": year,
        "total_due": round(grand_total, 2),
        "cards": card_results,
    }


@router.get("")
def list_cards(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    cards = (
        db.query(models.CreditCard)
        .filter(models.CreditCard.user_id == current_user.id)
        .order_by(models.CreditCard.created_at)
        .all()
    )
    return [_serialize_card(c) for c in cards]


@router.post("", status_code=201)
def create_card(
    data: CardCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    card = models.CreditCard(
        user_id=current_user.id,
        name=data.name,
        bank=data.bank,
        last_four=data.last_four,
        credit_limit=data.credit_limit,
        closing_day=data.closing_day,
        due_day=data.due_day,
        color=data.color,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return _serialize_card(card)


@router.put("/{card_id}")
def update_card(
    card_id: int,
    data: CardCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    card = db.query(models.CreditCard).filter(
        models.CreditCard.id == card_id,
        models.CreditCard.user_id == current_user.id,
    ).first()
    if not card:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
    for field, value in data.model_dump().items():
        setattr(card, field, value)
    db.commit()
    db.refresh(card)
    return _serialize_card(card)


@router.delete("/{card_id}", status_code=204)
def delete_card(
    card_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    card = db.query(models.CreditCard).filter(
        models.CreditCard.id == card_id,
        models.CreditCard.user_id == current_user.id,
    ).first()
    if not card:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
    db.delete(card)
    db.commit()


@router.post("/expenses", status_code=201)
def create_expense(
    data: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    card = db.query(models.CreditCard).filter(
        models.CreditCard.id == data.card_id,
        models.CreditCard.user_id == current_user.id,
    ).first()
    if not card:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")

    expense = models.CardExpense(
        user_id=current_user.id,
        card_id=data.card_id,
        description=data.description,
        total_amount=data.total_amount,
        installments=data.installments,
        first_payment_month=data.first_payment_month,
        first_payment_year=data.first_payment_year,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    now = datetime.utcnow()
    return _installment_info(expense, now.month, now.year)


@router.delete("/expenses/{expense_id}", status_code=204)
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    expense = db.query(models.CardExpense).filter(
        models.CardExpense.id == expense_id,
        models.CardExpense.user_id == current_user.id,
    ).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    db.delete(expense)
    db.commit()
