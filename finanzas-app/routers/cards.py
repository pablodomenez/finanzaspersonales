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

MONTH_NAMES = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun",
               "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]


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
    expense_type: str = "cuota"  # "cuota" | "debito_automatico"
    installments: int = Field(default=1, ge=1, le=120)
    first_payment_month: int = Field(ge=1, le=12)
    first_payment_year: int = Field(ge=2020, le=2100)
    end_month: Optional[int] = Field(None, ge=1, le=12)
    end_year: Optional[int] = Field(None, ge=2020, le=2100)


class PaymentCreate(BaseModel):
    card_id: int
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2020, le=2100)
    total_due: float = Field(ge=0)
    amount_paid: float = Field(ge=0)
    notes: str = ""


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


def _serialize_payment(p: models.CardPayment) -> dict:
    return {
        "id": p.id,
        "card_id": p.card_id,
        "month": p.month,
        "year": p.year,
        "total_due": p.total_due,
        "amount_paid": p.amount_paid,
        "pending_balance": p.pending_balance,
        "status": p.status,
        "paid_at": p.paid_at.isoformat() if p.paid_at else None,
        "notes": p.notes or "",
    }


def _etype(e: models.CardExpense) -> str:
    return e.expense_type or "cuota"


def _monthly_amount(e: models.CardExpense) -> float:
    if _etype(e) == "debito_automatico":
        return e.total_amount
    return e.total_amount / (e.installments or 1)


def _is_active(e: models.CardExpense, month: int, year: int) -> bool:
    qm = year * 12 + month
    fm = e.first_payment_year * 12 + e.first_payment_month
    if _etype(e) == "debito_automatico":
        if qm < fm:
            return False
        if e.end_year and e.end_month:
            return qm <= e.end_year * 12 + e.end_month
        return True
    pos = qm - fm + 1
    return 1 <= pos <= (e.installments or 1)


def _installment_info(e: models.CardExpense, month: int, year: int) -> dict:
    if _etype(e) == "debito_automatico":
        return {
            "id": e.id,
            "card_id": e.card_id,
            "description": e.description,
            "total_amount": e.total_amount,
            "expense_type": "debito_automatico",
            "installments": None,
            "installment_amount": e.total_amount,
            "installment_number": None,
            "remaining": None,
            "first_payment_month": e.first_payment_month,
            "first_payment_year": e.first_payment_year,
            "end_month": e.end_month,
            "end_year": e.end_year,
        }
    qm = year * 12 + month
    fm = e.first_payment_year * 12 + e.first_payment_month
    installment_number = qm - fm + 1
    remaining = (e.installments or 1) - installment_number
    installment_amount = round(e.total_amount / (e.installments or 1), 2)
    return {
        "id": e.id,
        "card_id": e.card_id,
        "description": e.description,
        "total_amount": e.total_amount,
        "expense_type": "cuota",
        "installments": e.installments,
        "installment_amount": installment_amount,
        "installment_number": installment_number,
        "remaining": remaining,
        "first_payment_month": e.first_payment_month,
        "first_payment_year": e.first_payment_year,
        "end_month": None,
        "end_year": None,
    }


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
    payments_this_month = (
        db.query(models.CardPayment)
        .filter(
            models.CardPayment.user_id == current_user.id,
            models.CardPayment.month == month,
            models.CardPayment.year == year,
        )
        .all()
    )
    payment_map = {p.card_id: p for p in payments_this_month}

    card_results = []
    grand_total = 0.0

    for card in cards:
        active = [e for e in all_expenses if e.card_id == card.id and _is_active(e, month, year)]
        monthly_total = round(sum(_monthly_amount(e) for e in active), 2)
        grand_total += monthly_total
        payment = payment_map.get(card.id)
        card_results.append({
            **_serialize_card(card),
            "monthly_total": monthly_total,
            "expense_count": len(active),
            "expenses": [_installment_info(e, month, year) for e in active],
            "payment": _serialize_payment(payment) if payment else None,
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

    etype = data.expense_type if data.expense_type in ("cuota", "debito_automatico") else "cuota"
    installments = 1 if etype == "debito_automatico" else data.installments

    expense = models.CardExpense(
        user_id=current_user.id,
        card_id=data.card_id,
        description=data.description,
        total_amount=data.total_amount,
        expense_type=etype,
        installments=installments,
        first_payment_month=data.first_payment_month,
        first_payment_year=data.first_payment_year,
        end_month=data.end_month if etype == "debito_automatico" else None,
        end_year=data.end_year if etype == "debito_automatico" else None,
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


@router.post("/payments", status_code=201)
def upsert_payment(
    data: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    card = db.query(models.CreditCard).filter(
        models.CreditCard.id == data.card_id,
        models.CreditCard.user_id == current_user.id,
    ).first()
    if not card:
        raise HTTPException(status_code=404, detail="Tarjeta no encontrada")

    pending = round(max(0.0, data.total_due - data.amount_paid), 2)
    status = "paid" if pending == 0 else "partial"

    existing = db.query(models.CardPayment).filter(
        models.CardPayment.card_id == data.card_id,
        models.CardPayment.month == data.month,
        models.CardPayment.year == data.year,
        models.CardPayment.user_id == current_user.id,
    ).first()

    if existing:
        existing.total_due = data.total_due
        existing.amount_paid = data.amount_paid
        existing.pending_balance = pending
        existing.status = status
        existing.notes = data.notes
        existing.paid_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        _upsert_card_payment_transaction(db, current_user.id, existing, card.name)
        db.commit()
        return _serialize_payment(existing)

    payment = models.CardPayment(
        user_id=current_user.id,
        card_id=data.card_id,
        month=data.month,
        year=data.year,
        total_due=data.total_due,
        amount_paid=data.amount_paid,
        pending_balance=pending,
        status=status,
        notes=data.notes,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    _upsert_card_payment_transaction(db, current_user.id, payment, card.name)
    db.commit()
    return _serialize_payment(payment)


def _upsert_card_payment_transaction(db, user_id: int, payment: models.CardPayment, card_name: str):
    if payment.amount_paid <= 0:
        # Si se borró el monto pagado, eliminar la transacción vinculada
        existing_tx = db.query(models.Transaction).filter(
            models.Transaction.user_id == user_id,
            models.Transaction.source_type == "card_payment",
            models.Transaction.source_id == payment.id,
        ).first()
        if existing_tx:
            db.delete(existing_tx)
        return

    month_name = MONTH_NAMES[payment.month] if 1 <= payment.month <= 12 else str(payment.month)
    desc = f"Pago tarjeta {card_name} — {month_name} {payment.year}"
    existing_tx = db.query(models.Transaction).filter(
        models.Transaction.user_id == user_id,
        models.Transaction.source_type == "card_payment",
        models.Transaction.source_id == payment.id,
    ).first()
    if existing_tx:
        existing_tx.amount = payment.amount_paid
        existing_tx.description = desc
        existing_tx.date = payment.paid_at or datetime.utcnow()
    else:
        db.add(models.Transaction(
            user_id=user_id,
            category_id=16,  # "Tarjeta de crédito"
            amount=payment.amount_paid,
            type=models.TransactionType.expense,
            description=desc,
            date=payment.paid_at or datetime.utcnow(),
            source_type="card_payment",
            source_id=payment.id,
        ))


@router.get("/payments/{card_id}")
def get_card_payments(
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

    payments = (
        db.query(models.CardPayment)
        .filter(
            models.CardPayment.card_id == card_id,
            models.CardPayment.user_id == current_user.id,
        )
        .order_by(models.CardPayment.year.desc(), models.CardPayment.month.desc())
        .all()
    )
    return [_serialize_payment(p) for p in payments]


@router.delete("/payments/{payment_id}", status_code=204)
def delete_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    payment = db.query(models.CardPayment).filter(
        models.CardPayment.id == payment_id,
        models.CardPayment.user_id == current_user.id,
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    db.delete(payment)
    db.commit()
