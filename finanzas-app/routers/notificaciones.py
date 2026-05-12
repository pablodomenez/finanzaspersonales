from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/api/notificaciones", tags=["notificaciones"])

_TIPO_META = {
    "servicio": {"icon": "zap",  "url": "/servicios.html",   "color": "blue"},
    "promo":    {"icon": "tag",  "url": "/promociones.html", "color": "amber"},
    "alquiler": {"icon": "home", "url": "/alquileres.html",  "color": "orange"},
}

def _ser(n, tipo):
    m = _TIPO_META.get(tipo, {"icon": "bell", "url": "/", "color": "violet"})
    return {
        "id": n.id,
        "tipo": tipo,
        "mensaje": n.mensaje,
        "leida": n.leida,
        "created_at": n.created_at.isoformat() if n.created_at else "",
        "icon": m["icon"],
        "url": m["url"],
        "color": m["color"],
    }


@router.get("")
def get_all(db: Session = Depends(get_db), user=Depends(get_current_user)):
    svc  = db.query(models.Notificacion).filter_by(user_id=user.id).order_by(models.Notificacion.created_at.desc()).limit(30).all()
    prom = db.query(models.NotificacionPromo).filter_by(user_id=user.id).order_by(models.NotificacionPromo.created_at.desc()).limit(30).all()
    alq  = db.query(models.NotificacionAlquiler).filter_by(user_id=user.id).order_by(models.NotificacionAlquiler.created_at.desc()).limit(30).all()

    merged = (
        [_ser(n, "servicio") for n in svc] +
        [_ser(n, "promo")    for n in prom] +
        [_ser(n, "alquiler") for n in alq]
    )
    merged.sort(key=lambda x: x["created_at"], reverse=True)
    return merged[:50]


@router.get("/count")
def get_count(db: Session = Depends(get_db), user=Depends(get_current_user)):
    total = (
        db.query(models.Notificacion).filter_by(user_id=user.id, leida=False).count() +
        db.query(models.NotificacionPromo).filter_by(user_id=user.id, leida=False).count() +
        db.query(models.NotificacionAlquiler).filter_by(user_id=user.id, leida=False).count()
    )
    return {"total": total}


@router.patch("/leer-todas", status_code=204)
def mark_all_read(db: Session = Depends(get_db), user=Depends(get_current_user)):
    db.query(models.Notificacion).filter_by(user_id=user.id, leida=False).update({"leida": True})
    db.query(models.NotificacionPromo).filter_by(user_id=user.id, leida=False).update({"leida": True})
    db.query(models.NotificacionAlquiler).filter_by(user_id=user.id, leida=False).update({"leida": True})
    db.commit()


@router.patch("/{tipo}/{notif_id}/leer", status_code=204)
def mark_one_read(tipo: str, notif_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    model_map = {
        "servicio": models.Notificacion,
        "promo":    models.NotificacionPromo,
        "alquiler": models.NotificacionAlquiler,
    }
    model = model_map.get(tipo)
    if not model:
        raise HTTPException(status_code=404, detail="Tipo inválido")
    n = db.query(model).filter_by(id=notif_id, user_id=user.id).first()
    if n:
        n.leida = True
        db.commit()
