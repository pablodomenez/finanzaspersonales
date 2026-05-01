from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/api/debts", tags=["debts"])


class DebtCreate(BaseModel):
    person_name: str = Field(min_length=1)
    description: Optional[str] = ""
    amount: float = Field(gt=0)
    type: models.DebtType
    due_date: Optional[datetime] = None


def _serialize(d: models.Debt) -> dict:
    overdue = False
    if d.due_date and not d.paid:
        overdue = d.due_date < datetime.utcnow()
    return {
        "id": d.id,
        "person_name": d.person_name,
        "description": d.description,
        "amount": d.amount,
        "type": d.type,
        "due_date": d.due_date.isoformat() if d.due_date else None,
        "paid": d.paid,
        "overdue": overdue,
    }


@router.get("")
def list_debts(
    type: Optional[models.DebtType] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.Debt).filter(models.Debt.user_id == current_user.id)
    if type:
        q = q.filter(models.Debt.type == type)
    return [_serialize(d) for d in q.order_by(models.Debt.paid, models.Debt.due_date.asc().nullslast()).all()]


@router.post("", status_code=201)
def create_debt(
    data: DebtCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    d = models.Debt(
        user_id=current_user.id,
        person_name=data.person_name,
        description=data.description or "",
        amount=data.amount,
        type=data.type,
        due_date=data.due_date,
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return _serialize(d)


@router.patch("/{debt_id}/toggle-paid")
def toggle_paid(
    debt_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    d = db.query(models.Debt).filter(
        models.Debt.id == debt_id,
        models.Debt.user_id == current_user.id,
    ).first()
    if not d:
        raise HTTPException(status_code=404, detail="Deuda no encontrada")
    d.paid = not d.paid
    db.commit()
    db.refresh(d)
    return _serialize(d)


@router.delete("/{debt_id}", status_code=204)
def delete_debt(
    debt_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    d = db.query(models.Debt).filter(
        models.Debt.id == debt_id,
        models.Debt.user_id == current_user.id,
    ).first()
    if not d:
        raise HTTPException(status_code=404, detail="Deuda no encontrada")
    db.delete(d)
    db.commit()
