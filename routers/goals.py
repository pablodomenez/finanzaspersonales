from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/api/goals", tags=["goals"])

GOAL_ICONS = ["🎯","✈️","🏠","🚗","💍","📱","🎓","🏋️","🌴","💻","🎸","🐶","💎","🏖️","🍕"]


class GoalCreate(BaseModel):
    name: str = Field(min_length=1)
    icon: str = "🎯"
    target_amount: float = Field(gt=0)
    deadline: Optional[datetime] = None


class GoalContribute(BaseModel):
    amount: float = Field(gt=0)


def _serialize(g: models.Goal) -> dict:
    pct = round((g.current_amount / g.target_amount) * 100, 1) if g.target_amount > 0 else 0
    days_left = None
    if g.deadline:
        diff = (g.deadline - datetime.utcnow()).days
        days_left = max(diff, 0)
    monthly_needed = None
    if g.deadline and days_left and days_left > 0:
        months_left = max(days_left / 30, 1)
        remaining = max(g.target_amount - g.current_amount, 0)
        monthly_needed = round(remaining / months_left, 2)
    return {
        "id": g.id,
        "name": g.name,
        "icon": g.icon,
        "target_amount": g.target_amount,
        "current_amount": round(g.current_amount, 2),
        "percentage": min(pct, 100),
        "deadline": g.deadline.isoformat() if g.deadline else None,
        "days_left": days_left,
        "monthly_needed": monthly_needed,
        "completed": g.current_amount >= g.target_amount,
    }


@router.get("")
def list_goals(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    goals = db.query(models.Goal).filter(models.Goal.user_id == current_user.id).order_by(models.Goal.created_at.desc()).all()
    return [_serialize(g) for g in goals]


@router.post("", status_code=201)
def create_goal(
    data: GoalCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    g = models.Goal(
        user_id=current_user.id,
        name=data.name,
        icon=data.icon,
        target_amount=data.target_amount,
        deadline=data.deadline,
    )
    db.add(g)
    db.commit()
    db.refresh(g)
    return _serialize(g)


@router.post("/{goal_id}/contribute")
def contribute(
    goal_id: int,
    data: GoalContribute,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    g = db.query(models.Goal).filter(
        models.Goal.id == goal_id,
        models.Goal.user_id == current_user.id,
    ).first()
    if not g:
        raise HTTPException(status_code=404, detail="Meta no encontrada")
    g.current_amount = round(g.current_amount + data.amount, 2)
    db.commit()
    db.refresh(g)
    return _serialize(g)


@router.delete("/{goal_id}", status_code=204)
def delete_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    g = db.query(models.Goal).filter(
        models.Goal.id == goal_id,
        models.Goal.user_id == current_user.id,
    ).first()
    if not g:
        raise HTTPException(status_code=404, detail="Meta no encontrada")
    db.delete(g)
    db.commit()


@router.get("/icons")
def get_icons():
    return GOAL_ICONS
