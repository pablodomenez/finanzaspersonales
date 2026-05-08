from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/api/feedback", tags=["feedback"])

TEMAS = [
    "General",
    "Dashboard",
    "Movimientos",
    "Presupuestos",
    "Tarjetas",
    "Deudas",
    "Objetivos",
    "Inversiones",
    "Servicios",
    "Promociones",
    "Compartidos",
    "Reportes",
    "Decisiones",
]


class FeedbackCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    tema: Optional[str] = "General"
    mensaje: Optional[str] = None


def _serialize(f: models.Feedback) -> dict:
    return {
        "id": f.id,
        "rating": f.rating,
        "tema": f.tema,
        "mensaje": f.mensaje,
        "created_at": f.created_at.isoformat() if f.created_at else None,
    }


@router.get("/me")
def list_my_feedbacks(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    feedbacks = (
        db.query(models.Feedback)
        .filter(models.Feedback.user_id == current_user.id)
        .order_by(models.Feedback.created_at.desc())
        .all()
    )
    return [_serialize(f) for f in feedbacks]


@router.post("", status_code=201)
def create_feedback(
    data: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    fb = models.Feedback(
        user_id=current_user.id,
        rating=data.rating,
        tema=data.tema or "General",
        mensaje=data.mensaje,
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return _serialize(fb)


@router.get("/temas")
def get_temas():
    return TEMAS
