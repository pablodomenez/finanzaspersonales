"""Panel de administración — acceso restringido a usuarios con is_admin=True."""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from database import get_db
from auth import get_admin_user
import models

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ── Usuarios ────────────────────────────────────────────────────────────────────

@router.get("/users")
def list_users(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_admin_user),
):
    q = db.query(models.User)
    if search:
        q = q.filter(
            models.User.email.ilike(f"%{search}%") |
            models.User.name.ilike(f"%{search}%")
        )
    users = q.order_by(models.User.created_at.desc()).all()

    # Conteos por usuario en una sola query para evitar N+1
    tx_counts = dict(
        db.query(models.Transaction.user_id, func.count(models.Transaction.id))
        .group_by(models.Transaction.user_id).all()
    )
    card_counts = dict(
        db.query(models.CreditCard.user_id, func.count(models.CreditCard.id))
        .group_by(models.CreditCard.user_id).all()
    )
    inv_counts = dict(
        db.query(models.Inversion.user_id, func.count(models.Inversion.id))
        .group_by(models.Inversion.user_id).all()
    )

    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "is_admin": bool(u.is_admin),
            "is_active": u.is_active if u.is_active is not None else True,
            "totp_enabled": bool(u.totp_enabled) if u.totp_enabled is not None else False,
            "has_google": u.google_id is not None,
            "onboarding_done": bool(u.onboarding_done),
            "tx_count": tx_counts.get(u.id, 0),
            "card_count": card_counts.get(u.id, 0),
            "inv_count": inv_counts.get(u.id, 0),
        }
        for u in users
    ]


@router.patch("/users/{user_id}/toggle-active")
def toggle_user_active(
    user_id: int,
    admin: models.User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="No podés desactivar tu propia cuenta")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user.is_active = not (user.is_active if user.is_active is not None else True)
    db.commit()
    return {"id": user.id, "is_active": user.is_active}


@router.patch("/users/{user_id}/toggle-admin")
def toggle_user_admin(
    user_id: int,
    admin: models.User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="No podés modificar tu propio rol de admin")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user.is_admin = not bool(user.is_admin)
    db.commit()
    return {"id": user.id, "is_admin": user.is_admin}


# ── Analytics ───────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_admin_user),
):
    now = datetime.utcnow()
    last_7 = now - timedelta(days=7)
    last_30 = now - timedelta(days=30)

    total_users = db.query(func.count(models.User.id)).scalar()
    new_7d = db.query(func.count(models.User.id)).filter(models.User.created_at >= last_7).scalar()
    new_30d = db.query(func.count(models.User.id)).filter(models.User.created_at >= last_30).scalar()
    active_users = db.query(func.count(models.User.id)).filter(
        models.User.is_active.is_(True) | models.User.is_active.is_(None)
    ).scalar()

    # Crecimiento diario últimos 30 días
    daily_signups = (
        db.query(
            func.date(models.User.created_at).label("date"),
            func.count(models.User.id).label("count"),
        )
        .filter(models.User.created_at >= last_30)
        .group_by(func.date(models.User.created_at))
        .order_by(func.date(models.User.created_at))
        .all()
    )

    # Uso de features
    feature_usage = {
        "transacciones": db.query(func.count(models.Transaction.id)).scalar(),
        "tarjetas": db.query(func.count(models.CreditCard.id)).scalar(),
        "presupuestos": db.query(func.count(models.Budget.id)).scalar(),
        "metas": db.query(func.count(models.Goal.id)).scalar(),
        "inversiones": db.query(func.count(models.Inversion.id)).scalar(),
        "servicios": db.query(func.count(models.Servicio.id)).scalar(),
        "alquileres": db.query(func.count(models.Alquiler.id)).scalar(),
        "prestamos": db.query(func.count(models.Prestamo.id)).scalar(),
        "grupos": db.query(func.count(models.SharedGroup.id)).scalar(),
    }

    # Distribución por moneda
    currency_dist = (
        db.query(models.UserProfile.currency, func.count(models.UserProfile.id))
        .group_by(models.UserProfile.currency)
        .all()
    )

    # 2FA y Google OAuth adoption
    totp_count = db.query(func.count(models.User.id)).filter(models.User.totp_enabled.is_(True)).scalar()
    google_count = db.query(func.count(models.User.id)).filter(models.User.google_id.isnot(None)).scalar()
    push_subs = db.query(func.count(models.PushSubscription.id)).scalar()

    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "new_7d": new_7d,
            "new_30d": new_30d,
            "totp_enabled": totp_count,
            "google_linked": google_count,
            "push_subscribed": push_subs,
        },
        "daily_signups": [{"date": str(r.date), "count": r.count} for r in daily_signups],
        "feature_usage": feature_usage,
        "currency_distribution": [{"currency": r[0] or "ARS", "count": r[1]} for r in currency_dist],
    }


# ── Feedback ────────────────────────────────────────────────────────────────────

@router.get("/feedback")
def list_feedback(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_admin_user),
):
    feedbacks = (
        db.query(models.Feedback, models.User.name, models.User.email)
        .join(models.User, models.Feedback.user_id == models.User.id)
        .order_by(models.Feedback.created_at.desc())
        .limit(200)
        .all()
    )
    items = [
        {
            "id": f.id,
            "rating": f.rating,
            "tema": f.tema,
            "mensaje": f.mensaje,
            "created_at": f.created_at.isoformat() if f.created_at else None,
            "user_name": name,
            "user_email": email,
        }
        for f, name, email in feedbacks
    ]
    avg = sum(i["rating"] for i in items) / len(items) if items else 0
    return {"items": items, "average_rating": round(avg, 2), "total": len(items)}


# ── Push broadcast ──────────────────────────────────────────────────────────────

class BroadcastRequest(BaseModel):
    title: str
    body: str
    url: str = "/dashboard.html"


@router.post("/push/broadcast")
async def broadcast_push(
    data: BroadcastRequest,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_admin_user),
):
    import json, os, logging
    logger = logging.getLogger("finanzas.admin")
    VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
    VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "")
    if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        raise HTTPException(status_code=503, detail="Web Push no configurado en el servidor")

    subscriptions = db.query(models.PushSubscription).all()
    if not subscriptions:
        return {"sent": 0, "failed": 0, "message": "No hay suscripciones registradas"}

    from pywebpush import webpush, WebPushException
    payload = {"title": data.title, "body": data.body, "url": data.url}
    VAPID_CLAIMS = {"sub": f"mailto:{os.getenv('VAPID_EMAIL', 'admin@finanzas.app')}"}
    sent = failed = 0
    dead = []
    for sub in subscriptions:
        try:
            webpush(
                subscription_info={"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth_key}},
                data=json.dumps(payload),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims=VAPID_CLAIMS,
            )
            sent += 1
        except Exception as e:
            logger.warning("Broadcast push error sub %s: %s", sub.id, e)
            failed += 1
            dead.append(sub.id)

    if dead:
        db.query(models.PushSubscription).filter(models.PushSubscription.id.in_(dead)).delete()
        db.commit()

    return {"sent": sent, "failed": failed}
