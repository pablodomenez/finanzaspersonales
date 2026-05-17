import asyncio
import json
from datetime import date, datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from database import get_db
from auth import get_current_user
import models

from promos_data import get_todas as _get_todas_globales, get_promos_hoy as _get_promos_hoy_globales

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


class PromocionRenovar(BaseModel):
    nueva_fecha_fin: str = Field(min_length=1)


DIAS_NOMBRE = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

CAT_PERIODICA_ICON = {
    "Supermercados": "🛒",
    "Farmacias": "💊",
    "Combustible": "⛽",
    "Gastronomia": "🍽️",
    "Indumentaria": "👗",
    "Electronica": "📱",
    "Viajes": "✈️",
    "Entretenimiento": "🎬",
    "Salud": "🏥",
    "Educacion": "📚",
    "Otros": "🏷️",
}


def _serialize_periodica(p: models.PromoPeriodica) -> dict:
    try:
        dias = json.loads(p.dias_semana) if p.dias_semana else []
    except (json.JSONDecodeError, TypeError):
        dias = []
    icono = CAT_PERIODICA_ICON.get(p.categoria, p.icono or "🏷️")
    return {
        "id": p.id,
        "nombre": p.nombre,
        "descripcion": p.descripcion,
        "categoria": p.categoria,
        "icono": icono,
        "dias_semana": dias,
        "dias_nombres": [DIAS_NOMBRE[d] for d in dias if 0 <= d <= 6],
        "descuento_pct": p.descuento_pct,
        "tope_reintegro": p.tope_reintegro,
        "medio_pago": p.medio_pago,
        "activa": p.activa,
        "notas": p.notas,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


class PromoPeriodicaCreate(BaseModel):
    nombre: str = Field(min_length=1)
    descripcion: Optional[str] = ""
    categoria: Optional[str] = ""
    dias_semana: List[int] = Field(default_factory=list)  # [0..6]
    descuento_pct: Optional[float] = None
    tope_reintegro: Optional[float] = None
    medio_pago: Optional[str] = ""
    icono: Optional[str] = "🏷️"
    notas: Optional[str] = ""


class PromoPeriodicaUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    dias_semana: Optional[List[int]] = None
    descuento_pct: Optional[float] = None
    tope_reintegro: Optional[float] = None
    medio_pago: Optional[str] = None
    icono: Optional[str] = None
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


@router.patch("/{promo_id}/renovar")
def renovar_promocion(
    promo_id: int,
    data: PromocionRenovar,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    p = db.query(models.Promocion).filter(
        models.Promocion.id == promo_id,
        models.Promocion.user_id == current_user.id,
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Promoción no encontrada")

    p.fecha_fin_promo = data.nueva_fecha_fin
    p.activa = True

    # marcar notificaciones anteriores como leídas
    db.query(models.NotificacionPromo).filter(
        models.NotificacionPromo.promocion_id == p.id,
        models.NotificacionPromo.leida == False,
    ).update({"leida": True})

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


# ── Promos globales (sin auth — datos públicos) ───────────────────────────────

@router.get("/globales")
def list_globales():
    """Devuelve todas las promos bancarias del dataset curado."""
    return _get_todas_globales()


@router.get("/globales/hoy")
def list_globales_hoy():
    """Devuelve las promos bancarias activas para el día de hoy."""
    weekday = date.today().weekday()  # 0=Lunes … 6=Domingo
    return _get_promos_hoy_globales(weekday)


# ── Promos periódicas ─────────────────────────────────────────────────────────

@router.get("/periodicas/hoy")
def list_periodicas_hoy(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    hoy = date.today().weekday()  # 0=Lunes … 6=Domingo
    items = (
        db.query(models.PromoPeriodica)
        .filter(
            models.PromoPeriodica.user_id == current_user.id,
            models.PromoPeriodica.activa == True,
        )
        .all()
    )
    resultado = []
    for p in items:
        try:
            dias = json.loads(p.dias_semana) if p.dias_semana else []
        except (json.JSONDecodeError, TypeError):
            dias = []
        if hoy in dias:
            resultado.append(_serialize_periodica(p))
    return resultado


@router.get("/periodicas")
def list_periodicas(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    items = (
        db.query(models.PromoPeriodica)
        .filter(models.PromoPeriodica.user_id == current_user.id)
        .order_by(models.PromoPeriodica.nombre.asc())
        .all()
    )
    return [_serialize_periodica(p) for p in items]


@router.post("/periodicas", status_code=201)
def create_periodica(
    data: PromoPeriodicaCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    dias_validos = [d for d in data.dias_semana if 0 <= d <= 6]
    icono = CAT_PERIODICA_ICON.get(data.categoria or "", data.icono or "🏷️")
    p = models.PromoPeriodica(
        user_id=current_user.id,
        nombre=data.nombre,
        descripcion=data.descripcion or "",
        categoria=data.categoria or "",
        dias_semana=json.dumps(sorted(set(dias_validos))),
        descuento_pct=data.descuento_pct,
        tope_reintegro=data.tope_reintegro,
        medio_pago=data.medio_pago or "",
        icono=icono,
        notas=data.notas or "",
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _serialize_periodica(p)


@router.put("/periodicas/{promo_id}")
def update_periodica(
    promo_id: int,
    data: PromoPeriodicaUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    p = db.query(models.PromoPeriodica).filter(
        models.PromoPeriodica.id == promo_id,
        models.PromoPeriodica.user_id == current_user.id,
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Promo periódica no encontrada")

    if data.nombre is not None:
        p.nombre = data.nombre
    if data.descripcion is not None:
        p.descripcion = data.descripcion
    if data.categoria is not None:
        p.categoria = data.categoria
        p.icono = CAT_PERIODICA_ICON.get(data.categoria, p.icono)
    if data.dias_semana is not None:
        dias_validos = [d for d in data.dias_semana if 0 <= d <= 6]
        p.dias_semana = json.dumps(sorted(set(dias_validos)))
    if data.descuento_pct is not None:
        p.descuento_pct = data.descuento_pct
    if data.tope_reintegro is not None:
        p.tope_reintegro = data.tope_reintegro
    if data.medio_pago is not None:
        p.medio_pago = data.medio_pago
    if data.icono is not None:
        p.icono = data.icono
    if data.activa is not None:
        p.activa = data.activa
    if data.notas is not None:
        p.notas = data.notas

    db.commit()
    db.refresh(p)
    return _serialize_periodica(p)


@router.delete("/periodicas/{promo_id}", status_code=204)
def delete_periodica(
    promo_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    p = db.query(models.PromoPeriodica).filter(
        models.PromoPeriodica.id == promo_id,
        models.PromoPeriodica.user_id == current_user.id,
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Promo periódica no encontrada")
    db.delete(p)
    db.commit()


@router.post("/periodicas/notificar", status_code=200)
def trigger_notif_periodicas(current_user: models.User = Depends(get_current_user)):
    _notify_promos_hoy_sync(user_id=current_user.id)
    return {"status": "ok"}


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


def _notify_promos_hoy_sync(user_id: int = None):
    """Envía push a usuarios con promos periódicas activas para el día de hoy."""
    from database import SessionLocal
    from routers.push import send_push_to_user
    db = SessionLocal()
    try:
        hoy = date.today().weekday()  # 0=Lun … 6=Dom
        nombre_dia = DIAS_NOMBRE[hoy]

        query = db.query(models.PromoPeriodica).filter(
            models.PromoPeriodica.activa == True
        )
        if user_id is not None:
            query = query.filter(models.PromoPeriodica.user_id == user_id)

        todas = query.all()

        # Agrupar por usuario
        por_usuario: dict[int, list] = {}
        for p in todas:
            try:
                dias = json.loads(p.dias_semana) if p.dias_semana else []
            except (json.JSONDecodeError, TypeError):
                dias = []
            if hoy in dias:
                por_usuario.setdefault(p.user_id, []).append(p)

        for uid, promos in por_usuario.items():
            nombres = ", ".join(p.nombre for p in promos[:3])
            if len(promos) > 3:
                nombres += f" y {len(promos) - 3} más"
            body = f"{nombres}"
            asyncio.run(send_push_to_user(
                user_id=uid,
                title=f"📢 Promos de hoy ({nombre_dia})",
                body=body,
                url="/promociones.html",
                db=db,
            ))
    finally:
        db.close()


async def check_periodicas_loop():
    """Loop diario que notifica promos del día a las 08:00."""
    import time
    # Esperar hasta las 08:00 del día siguiente
    now = datetime.now()
    target = now.replace(hour=8, minute=0, second=0, microsecond=0)
    if now >= target:
        target = target + timedelta(days=1)
    delay = (target - now).total_seconds()
    await asyncio.sleep(delay)

    while True:
        try:
            await asyncio.to_thread(_notify_promos_hoy_sync)
        except Exception as e:
            print(f"[PromoPeriodicasScheduler] Error: {e}")
        await asyncio.sleep(24 * 3600)
