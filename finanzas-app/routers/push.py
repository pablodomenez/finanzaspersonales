"""Web Push Notifications — suscripción y envío de alertas."""
import json
import os
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
import models

logger = logging.getLogger("finanzas.push")
router = APIRouter(prefix="/api/push", tags=["push"])

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_PUBLIC_KEY  = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_CLAIMS      = {"sub": f"mailto:{os.getenv('VAPID_EMAIL', 'admin@finanzas.app')}"}


def _send_push(subscription_info: dict, payload: dict) -> bool:
    """Envía una notificación push. Retorna True si fue exitoso."""
    if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        return False
    try:
        from pywebpush import webpush, WebPushException
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=VAPID_CLAIMS,
        )
        return True
    except Exception as e:
        logger.warning("Push error: %s", e)
        return False


async def send_push_to_user(user_id: int, title: str, body: str, url: str = "/", db: Session = None):
    """Envía una notificación push a todas las suscripciones del usuario."""
    if db is None:
        return
    subscriptions = db.query(models.PushSubscription).filter(
        models.PushSubscription.user_id == user_id
    ).all()
    payload = {"title": title, "body": body, "url": url}
    dead = []
    for sub in subscriptions:
        info = {"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth_key}}
        ok = _send_push(info, payload)
        if not ok:
            dead.append(sub.id)
    # Eliminar suscripciones muertas
    if dead:
        db.query(models.PushSubscription).filter(models.PushSubscription.id.in_(dead)).delete()
        db.commit()


@router.get("/vapid-public-key", summary="Clave pública VAPID para suscripción")
def get_vapid_key():
    if not VAPID_PUBLIC_KEY:
        raise HTTPException(status_code=503, detail="Web Push no configurado en el servidor")
    return {"public_key": VAPID_PUBLIC_KEY}


class SubscribeRequest(BaseModel):
    endpoint: str
    keys: dict  # {"p256dh": "...", "auth": "..."}


@router.post("/subscribe", summary="Registrar suscripción push")
def subscribe(
    data: SubscribeRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not VAPID_PUBLIC_KEY:
        raise HTTPException(status_code=503, detail="Web Push no configurado")

    # Upsert: actualizar si ya existe el endpoint, crear si no
    existing = db.query(models.PushSubscription).filter(
        models.PushSubscription.endpoint == data.endpoint
    ).first()

    if existing:
        existing.user_id  = current_user.id
        existing.p256dh   = data.keys.get("p256dh", "")
        existing.auth_key = data.keys.get("auth", "")
    else:
        sub = models.PushSubscription(
            user_id  = current_user.id,
            endpoint = data.endpoint,
            p256dh   = data.keys.get("p256dh", ""),
            auth_key = data.keys.get("auth", ""),
        )
        db.add(sub)
    db.commit()
    return {"ok": True}


class UnsubscribeRequest(BaseModel):
    endpoint: str


@router.post("/unsubscribe", summary="Eliminar suscripción push")
def unsubscribe(
    data: UnsubscribeRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(models.PushSubscription).filter(
        models.PushSubscription.user_id == current_user.id,
        models.PushSubscription.endpoint == data.endpoint,
    ).delete()
    db.commit()
    return {"ok": True}


@router.post("/test", summary="Enviar notificación push de prueba")
def send_test(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    import asyncio
    asyncio.create_task(send_push_to_user(
        user_id=current_user.id,
        title="FinanzasApp",
        body="¡Las notificaciones push están funcionando! 🎉",
        url="/dashboard.html",
        db=db,
    ))
    return {"ok": True}
