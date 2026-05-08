from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import extract
from pydantic import BaseModel, Field
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


class TransactionCreate(BaseModel):
    amount: float = Field(gt=0)
    type: models.TransactionType
    category_id: int
    description: Optional[str] = ""
    date: Optional[datetime] = None
    payment_method: Optional[str] = None


class TransactionUpdate(BaseModel):
    amount: Optional[float] = Field(default=None, gt=0)
    type: Optional[models.TransactionType] = None
    category_id: Optional[int] = None
    description: Optional[str] = None
    date: Optional[datetime] = None
    payment_method: Optional[str] = None


def _serialize(t: models.Transaction) -> dict:
    return {
        "id": t.id,
        "amount": t.amount,
        "type": t.type,
        "description": t.description,
        "date": t.date.isoformat(),
        "payment_method": t.payment_method,
        "category": {"id": t.category.id, "name": t.category.name, "icon": t.category.icon},
    }


@router.get("")
def list_transactions(
    month: Optional[int] = None,
    year: Optional[int] = None,
    type: Optional[models.TransactionType] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = (
        db.query(models.Transaction)
        .options(joinedload(models.Transaction.category))
        .filter(models.Transaction.user_id == current_user.id)
    )
    if month:
        if not 1 <= month <= 12:
            raise HTTPException(status_code=422, detail="El mes debe ser entre 1 y 12")
        q = q.filter(extract("month", models.Transaction.date) == month)
    if year:
        if not 2000 <= year <= 2100:
            raise HTTPException(status_code=422, detail="Año fuera de rango")
        q = q.filter(extract("year", models.Transaction.date) == year)
    if type:
        q = q.filter(models.Transaction.type == type)
    return [_serialize(t) for t in q.order_by(models.Transaction.date.desc()).all()]


@router.post("", status_code=201)
def create_transaction(
    data: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not db.query(models.Category).filter(models.Category.id == data.category_id).first():
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    t = models.Transaction(
        user_id=current_user.id,
        amount=data.amount,
        type=data.type,
        category_id=data.category_id,
        description=data.description or "",
        date=data.date or datetime.utcnow(),
        payment_method=data.payment_method,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    # Cargar relación explícitamente para el response
    db.query(models.Transaction).options(joinedload(models.Transaction.category)).filter(models.Transaction.id == t.id).first()
    return _serialize(t)


@router.put("/{transaction_id}")
def update_transaction(
    transaction_id: int,
    data: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    t = db.query(models.Transaction).filter(
        models.Transaction.id == transaction_id,
        models.Transaction.user_id == current_user.id,
    ).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(t, field, value)
    db.commit()
    db.refresh(t)
    return _serialize(t)


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    t = db.query(models.Transaction).filter(
        models.Transaction.id == transaction_id,
        models.Transaction.user_id == current_user.id,
    ).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    db.delete(t)
    db.commit()
