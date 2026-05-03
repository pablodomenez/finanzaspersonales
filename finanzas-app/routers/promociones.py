import asyncio
from datetime import date, datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/api/promociones", tags=["promociones"])

CAT_ICON = {
    "Internet": "🌐",
    "Telefonia": "📱",
    "Streaming": "📺",
    "Cable": "📡",
    "Seguro": "🛡️",
    "Banco": "🏦",
    "Electricidad": "⚡",
    "Gas": "🔥",
    "Agua": "💧",
    "Gimnasio": "💪",
    "Suscripcion": "📧",
    "Otros": "🏷️",
}


def _serialize(p: models.Promocion) -> dict:
    today = date.today()
    dias_restantes = None
    vencida = False
    if p.fecha_fin_promo:
        try:
            fin = date.fromisoformat(p.fecha_fin_promo)
            dias_restantes = (fin - today).days
            vencida = dias_restantes < 0
        except ValueError:
            pass

    ahorro_mensual = None
    if p.monto_sin_promo is not None and p.monto_sin_promo > 0:
        ahorro_mensual = round(p.monto_sin_promo - p.monto_con_promo, 2)

    return {
        "id": p.id,
        "servicio_nombre": p.servicio_nombre,
        "categoria": p.categoria,
        "icono": CAT_ICON.get(p.categoria, "🏷️"),
        "descripcion_promo": p.descripcion_promo,
        "monto_con_promo": p.monto_con_promo,
        "monto_sin_promo": p.monto_sin_promo,
        "ahorro_mensual": ahorro_mensual,
        "numero_cliente": p.numero_cliente,
        "telefono_contacto": p.telefono_contacto,
        "link_contacto": p.link_contacto,
        "fecha_inicio_promo": p.fecha_inicio_promo,
        "fecha_fin_promo": p.fecha_fin_promo,
        "dias_restantes": dias_restantes,
        "vencida": vencida,
        "activa": p.activa,
        "notas": p.notas,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def _serialize_notif(n: models.NotificacionPromo) -> dict:
    return {
        "id": n.id,
        "promocion_id": n.promocion_id,
        "servicio_nombre": n.promocion.servicio_nombre if n.promocion else "",
        "mensaje": n.mensaje,
        "leida": n.leida,
        "vencimiento_ref": n.vencimiento_ref,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


# ── Schemas ───────────────────────────────────────────────────────────────────

class PromocionCreate(BaseModel):
    servicio_nombre: str = Field(min_length=1)
    categoria: str = ""
    descripcion_promo: Optional[str] = ""
    monto_con_promo: float = Field(gt=0)
    monto_sin_promo: Optional[float] = None
    numero_cliente: Optional[str] = ""
    telefono_contacto: Optional[str] = ""
    link_contacto: Optional[str] = ""
    fecha_inicio_promo: Optional[str] = None
    fecha_fin_promo: str = Field(min_length=1)
    notas: Optional[str] = ""


class PromocionUpdate(BaseModel):
    servicio_nombre: Optional[str] = None
    categoria: Optional[str] = None
    descripcion_promo: Optional[str] = None
    monto_con_promo: Optional[float] = None
    monto_sin_promo: Optional[float] = None
    numero_cliente: Optional[str] = None
    telefono_contacto: Optional[str] = None
    link_contacto: Optional[str] = None
    fecha_inicio_promo: Optional[str] = None
    fecha_fin_promo: Optional[str] = None
    activa: Optional[bool] = None
    notas: Optional[str] = None


# ── Rutas ─────────────────────────────────────────────────────────────────────

@router.get("")
def list_promociones(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    items = (
        db.query(models.Promocion)
        .filter(models.Promocion.user_id == current_user.id)
        .order_by(models.Promocion.fecha_fin_promo.asc())
        .all()
    )
    return [_serialize(p) for p in items]


@router.post("", status_code=201)
def create_promocion(
    data: PromocionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    p = models.Promocion(
        user_id=current_user.id,
        servicio_nombre=data.servicio_nombre,
        categoria=data.categoria or "",
        descripcion_promo=data.descripcion_promo or "",
        monto_con_promo=data.monto_con_promo,
        monto_sin_promo=data.monto_sin_promo,
        numero_cliente=data.numero_cliente or "",
        telefono_contacto=data.telefono_contacto or "",
        link_contacto=data.link_contacto or "",
        fecha_inicio_promo=data.fecha_inicio_promo,
        fecha_fin_promo=data.fecha_fin_promo,
        notas=data.notas or "",
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _serialize(p)


@router.put("/{promo_id}")
def update_promocion(
    promo_id: int,
    data: PromocionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    p = db.query(models.Promocion).filter(
        models.Promocion.id == promo_id,
        models.Promocion.user_id == current_user.id,
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Promoción no encontrada")

    if data.servicio_nombre is not None:
        p.servicio_nombre = data.servicio_nombre
    if data.categoria is not None:
        p.categoria = data.categoria
    if data.descripcion_promo is not None:
        p.descripcion_promo = data.descripcion_promo
    if data.monto_con_promo is not None:
        p.monto_con_promo = data.monto_con_promo
    if data.monto_sin_promo is not None:
        p.monto_sin_promo = data.monto_sin_promo
    if data.numero_cliente is not None:
        p.numero_cliente = data.numero_cliente
    if data.telefono_contacto is not None:
        p.telefono_contacto = data.telefono_contacto
    if data.link_contacto is not None:
        p.link_contacto = data.link_contacto
    if data.fecha_inicio_promo is not None:
        p.fecha_inicio_promo = data.fecha_inicio_promo
    if data.fecha_fin_promo is not None:
        p.fecha_fin_promo = data.fecha_fin_promo
    if data.activa is not None:
        p.activa = data.activa
    if data.notas is not None:
        p.notas = data.notas

    db.commit()
    db.refresh(p)
    return _serialize(p)


@router.delete("/{promo_id}", status_code=204)
def delete_promocion(
    promo_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    p = db.query(models.Promocion).filter(
        models.Promocion.id == promo_id,
        models.Promocion.user_id == current_user.id,
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Promoción no encontrada")
    db.delete(p)
    db.commit()


@router.get("/notificaciones")
def list_notificaciones(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    items = (
        db.query(models.NotificacionPromo)
        .filter(models.NotificacionPromo.user_id == current_user.id)
        .order_by(models.NotificacionPromo.created_at.desc())
        .limit(50)
        .all()
    )
    return [_serialize_notif(n) for n in items]


@router.post("/check-vencimientos", status_code=200)
def trigger_check(current_user: models.User = Depends(get_current_user)):
    _check_promo_sync()
    return {"status": "ok"}


@router.patch("/notificaciones/leer-todas", status_code=204)
def leer_todas(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db.query(models.NotificacionPromo).filter(
        models.NotificacionPromo.user_id == current_user.id,
        models.NotificacionPromo.leida == False,
    ).update({"leida": True})
    db.commit()


@router.patch("/notificaciones/{notif_id}/leer", status_code=204)
def leer_notificacion(
    notif_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    n = db.query(models.NotificacionPromo).filter(
        models.NotificacionPromo.id == notif_id,
        models.NotificacionPromo.user_id == current_user.id,
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    n.leida = True
    db.commit()


# ── Scheduler ─────────────────────────────────────────────────────────────────

def _check_promo_sync():
    from database import SessionLocal
    db = SessionLocal()
    try:
        today = date.today()
        alert_days = 7  # notificar 1 semana antes

        promos = db.query(models.Promocion).filter(models.Promocion.activa == True).all()

        for p in promos:
            if not p.fecha_fin_promo:
                continue
            try:
                fin = date.fromisoformat(p.fecha_fin_promo)
            except ValueError:
                continue

            dias = (fin - today).days

            if dias < 0:
                # promo vencida — notificar una sola vez
                _crear_notif_promo(db, p, fin, vencida=True)
            elif dias <= alert_days:
                _crear_notif_promo(db, p, fin, vencida=False)
    finally:
        db.close()


def _crear_notif_promo(db, promo: models.Promocion, fin: date, vencida: bool):
    existing = db.query(models.NotificacionPromo).filter(
        models.NotificacionPromo.promocion_id == promo.id,
        models.NotificacionPromo.vencimiento_ref == fin.isoformat(),
    ).first()
    if existing:
        return

    today = date.today()
    if vencida:
        mensaje = (
            f"⚠️ La promo de '{promo.servicio_nombre}' venció el {fin.strftime('%d/%m/%Y')}. "
            f"Contactá al proveedor para renovarla."
        )
    else:
        dias = (fin - today).days
        if dias == 0:
            cuando = "hoy"
        elif dias == 1:
            cuando = "mañana"
        else:
            cuando = f"en {dias} días ({fin.strftime('%d/%m/%Y')})"
        mensaje = (
            f"🏷️ La promo de '{promo.servicio_nombre}' vence {cuando}. "
            f"¡Contactá al proveedor para renovarla!"
        )

    notif = models.NotificacionPromo(
        user_id=promo.user_id,
        promocion_id=promo.id,
        mensaje=mensaje,
        vencimiento_ref=fin.isoformat(),
    )
    db.add(notif)
    db.commit()


async def check_promo_loop():
    while True:
        try:
            await asyncio.to_thread(_check_promo_sync)
        except Exception as e:
            print(f"[PromoScheduler] Error: {e}")
        await asyncio.sleep(24 * 3600)
