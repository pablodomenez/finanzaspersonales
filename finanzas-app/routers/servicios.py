import asyncio
import calendar
from datetime import date, datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel, Field
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/api/servicios", tags=["servicios"])

FRECUENCIA_MESES = {
    "mensual": 1,
    "bimestral": 2,
    "trimestral": 3,
    "semestral": 6,
    "anual": 12,
}

FRECUENCIA_FACTOR = {
    "mensual": 1.0,
    "bimestral": 0.5,
    "trimestral": 1 / 3,
    "semestral": 1 / 6,
    "anual": 1 / 12,
}

CAT_ICON = {
    "Electricidad": "⚡",
    "Gas": "🔥",
    "Agua": "💧",
    "Internet": "🌐",
    "Telefonia": "📱",
    "Streaming": "📺",
    "Seguro": "🛡️",
    "Alquiler": "🏠",
    "Expensas": "🏢",
    "Suscripcion": "📧",
    "IVA": "🧾",
    "Ingresos Brutos": "🏛️",
    "Monotributo": "📋",
    "Otros": "💡",
}


def calcular_proximo_vencimiento(dia: int, frecuencia: str, desde: date = None) -> date:
    if desde is None:
        desde = date.today()

    meses_inc = FRECUENCIA_MESES.get(frecuencia, 1)
    year, month = desde.year, desde.month

    max_day = calendar.monthrange(year, month)[1]
    candidate = date(year, month, min(dia, max_day))

    while candidate <= desde:
        total = (year * 12 + month - 1) + meses_inc
        year = total // 12
        month = total % 12 + 1
        max_day = calendar.monthrange(year, month)[1]
        candidate = date(year, month, min(dia, max_day))

    return candidate


def _serialize(s: models.Servicio) -> dict:
    today = date.today()
    venc = None
    dias_restantes = None
    if s.proximo_vencimiento:
        try:
            venc = date.fromisoformat(s.proximo_vencimiento)
            dias_restantes = (venc - today).days
        except ValueError:
            pass

    periodo_actual = f"{today.year}-{today.month:02d}"
    try:
        pagos = list(s.pagos)
    except Exception:
        pagos = []

    pagado_mes_actual = any(p.periodo == periodo_actual for p in pagos)
    ultimo_pago = max(pagos, key=lambda p: p.fecha_pago) if pagos else None

    return {
        "id": s.id,
        "nombre": s.nombre,
        "categoria": s.categoria,
        "icono": CAT_ICON.get(s.categoria, "💡"),
        "monto": s.monto,
        "dia_vencimiento": s.dia_vencimiento,
        "frecuencia": s.frecuencia,
        "notas": s.notas,
        "numero_cuenta": getattr(s, "numero_cuenta", "") or "",
        "link_pago": getattr(s, "link_pago", "") or "",
        "monto_variable": getattr(s, "monto_variable", False) or False,
        "activo": s.activo,
        "proximo_vencimiento": s.proximo_vencimiento,
        "dias_restantes": dias_restantes,
        "pagado_mes_actual": pagado_mes_actual,
        "ultimo_pago": {
            "monto_pagado": ultimo_pago.monto_pagado,
            "fecha_pago": ultimo_pago.fecha_pago,
            "periodo": ultimo_pago.periodo,
        } if ultimo_pago else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


def _serialize_pago(p: models.PagoServicio) -> dict:
    return {
        "id": p.id,
        "servicio_id": p.servicio_id,
        "monto_pagado": p.monto_pagado,
        "fecha_pago": p.fecha_pago,
        "periodo": p.periodo,
        "forma_pago": getattr(p, "forma_pago", "") or "",
        "notas": p.notas,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def _serialize_notif(n: models.Notificacion) -> dict:
    return {
        "id": n.id,
        "servicio_id": n.servicio_id,
        "servicio_nombre": n.servicio.nombre if n.servicio else "",
        "mensaje": n.mensaje,
        "leida": n.leida,
        "vencimiento_ref": n.vencimiento_ref,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


# ── Schemas ───────────────────────────────────────────────────────────────────

class ServicioCreate(BaseModel):
    nombre: str = Field(min_length=1)
    categoria: str = Field(min_length=1)
    monto: float = Field(gt=0)
    dia_vencimiento: int = Field(ge=1, le=28)
    frecuencia: str = "mensual"
    notas: Optional[str] = ""
    numero_cuenta: Optional[str] = ""
    link_pago: Optional[str] = ""
    monto_variable: Optional[bool] = False


class ServicioUpdate(BaseModel):
    nombre: Optional[str] = None
    categoria: Optional[str] = None
    monto: Optional[float] = None
    dia_vencimiento: Optional[int] = Field(default=None, ge=1, le=28)
    frecuencia: Optional[str] = None
    notas: Optional[str] = None
    numero_cuenta: Optional[str] = None
    link_pago: Optional[str] = None
    monto_variable: Optional[bool] = None
    activo: Optional[bool] = None


class PagoCreate(BaseModel):
    monto_pagado: float = Field(gt=0)
    fecha_pago: str                   # YYYY-MM-DD
    periodo: str                      # YYYY-MM
    forma_pago: Optional[str] = ""
    notas: Optional[str] = ""


# ── Rutas: colecciones / estáticas primero, luego /{id} ──────────────────────

@router.get("")
def list_servicios(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    items = (
        db.query(models.Servicio)
        .options(joinedload(models.Servicio.pagos))
        .filter(models.Servicio.user_id == current_user.id)
        .order_by(models.Servicio.activo.desc(), models.Servicio.proximo_vencimiento.asc())
        .all()
    )
    return [_serialize(s) for s in items]


@router.post("", status_code=201)
def create_servicio(
    data: ServicioCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    frecuencia = data.frecuencia if data.frecuencia in FRECUENCIA_MESES else "mensual"
    proximo = calcular_proximo_vencimiento(data.dia_vencimiento, frecuencia)
    s = models.Servicio(
        user_id=current_user.id,
        nombre=data.nombre,
        categoria=data.categoria,
        monto=data.monto,
        dia_vencimiento=data.dia_vencimiento,
        frecuencia=frecuencia,
        notas=data.notas or "",
        numero_cuenta=data.numero_cuenta or "",
        link_pago=data.link_pago or "",
        monto_variable=data.monto_variable or False,
        proximo_vencimiento=proximo.isoformat(),
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return _serialize(s)


@router.get("/notificaciones")
def list_notificaciones(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    items = (
        db.query(models.Notificacion)
        .filter(models.Notificacion.user_id == current_user.id)
        .order_by(models.Notificacion.created_at.desc())
        .limit(50)
        .all()
    )
    return [_serialize_notif(n) for n in items]


@router.post("/check-vencimientos", status_code=200)
def trigger_check_vencimientos(current_user: models.User = Depends(get_current_user)):
    """Ejecuta el chequeo de vencimientos on-demand (reemplaza el scheduler en Vercel)."""
    _check_vencimientos_sync()
    return {"status": "ok"}


@router.patch("/notificaciones/leer-todas", status_code=204)
def leer_todas(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db.query(models.Notificacion).filter(
        models.Notificacion.user_id == current_user.id,
        models.Notificacion.leida == False,
    ).update({"leida": True})
    db.commit()


@router.patch("/notificaciones/{notif_id}/leer", status_code=204)
def leer_notificacion(
    notif_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    n = db.query(models.Notificacion).filter(
        models.Notificacion.id == notif_id,
        models.Notificacion.user_id == current_user.id,
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    n.leida = True
    db.commit()


@router.delete("/pagos/{pago_id}", status_code=204)
def delete_pago(
    pago_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    p = db.query(models.PagoServicio).filter(
        models.PagoServicio.id == pago_id,
        models.PagoServicio.user_id == current_user.id,
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    db.delete(p)
    db.commit()


@router.get("/resumen-mensual")
def resumen_mensual(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Estimado mensual de servicios activos para el dashboard."""
    servicios = (
        db.query(models.Servicio)
        .filter(models.Servicio.user_id == current_user.id, models.Servicio.activo == True)
        .all()
    )
    total = round(sum(s.monto * FRECUENCIA_FACTOR.get(s.frecuencia, 1) for s in servicios), 2)
    return {"mensual": total, "count": len(servicios)}


@router.put("/{servicio_id}")
def update_servicio(
    servicio_id: int,
    data: ServicioUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    s = db.query(models.Servicio).filter(
        models.Servicio.id == servicio_id,
        models.Servicio.user_id == current_user.id,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    recalcular = False
    if data.nombre is not None:
        s.nombre = data.nombre
    if data.categoria is not None:
        s.categoria = data.categoria
    if data.monto is not None:
        s.monto = data.monto
    if data.dia_vencimiento is not None:
        s.dia_vencimiento = data.dia_vencimiento
        recalcular = True
    if data.frecuencia is not None:
        s.frecuencia = data.frecuencia
        recalcular = True
    if data.notas is not None:
        s.notas = data.notas
    if data.numero_cuenta is not None:
        s.numero_cuenta = data.numero_cuenta
    if data.link_pago is not None:
        s.link_pago = data.link_pago
    if data.monto_variable is not None:
        s.monto_variable = data.monto_variable
    if data.activo is not None:
        s.activo = data.activo

    if recalcular:
        s.proximo_vencimiento = calcular_proximo_vencimiento(
            s.dia_vencimiento, s.frecuencia
        ).isoformat()

    db.commit()
    db.refresh(s)
    return _serialize(s)


@router.delete("/{servicio_id}", status_code=204)
def delete_servicio(
    servicio_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    s = db.query(models.Servicio).filter(
        models.Servicio.id == servicio_id,
        models.Servicio.user_id == current_user.id,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    db.delete(s)
    db.commit()


@router.get("/{servicio_id}/pagos")
def list_pagos(
    servicio_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    s = db.query(models.Servicio).filter(
        models.Servicio.id == servicio_id,
        models.Servicio.user_id == current_user.id,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    pagos = (
        db.query(models.PagoServicio)
        .filter(models.PagoServicio.servicio_id == servicio_id)
        .order_by(models.PagoServicio.fecha_pago.desc())
        .all()
    )
    return [_serialize_pago(p) for p in pagos]


@router.post("/{servicio_id}/pagar", status_code=201)
def registrar_pago(
    servicio_id: int,
    data: PagoCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    s = db.query(models.Servicio).filter(
        models.Servicio.id == servicio_id,
        models.Servicio.user_id == current_user.id,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    pago = models.PagoServicio(
        user_id=current_user.id,
        servicio_id=s.id,
        monto_pagado=data.monto_pagado,
        fecha_pago=data.fecha_pago,
        periodo=data.periodo,
        forma_pago=data.forma_pago or "",
        notas=data.notas or "",
    )
    db.add(pago)

    # Avanzar próximo vencimiento al siguiente período
    try:
        venc_actual = date.fromisoformat(s.proximo_vencimiento) if s.proximo_vencimiento else date.today()
    except ValueError:
        venc_actual = date.today()

    nuevo_venc = calcular_proximo_vencimiento(s.dia_vencimiento, s.frecuencia, venc_actual)
    s.proximo_vencimiento = nuevo_venc.isoformat()

    # Marcar notificaciones de este servicio como leídas
    db.query(models.Notificacion).filter(
        models.Notificacion.servicio_id == s.id,
        models.Notificacion.leida == False,
    ).update({"leida": True})

    db.commit()
    db.refresh(pago)
    return _serialize_pago(pago)


# ── Scheduler ─────────────────────────────────────────────────────────────────

def _check_vencimientos_sync():
    from database import SessionLocal
    db = SessionLocal()
    try:
        today = date.today()
        alert_limit = today + timedelta(days=2)

        servicios = db.query(models.Servicio).filter(models.Servicio.activo == True).all()

        for s in servicios:
            if not s.proximo_vencimiento:
                continue
            try:
                venc = date.fromisoformat(s.proximo_vencimiento)
            except ValueError:
                continue

            if venc < today:
                _crear_notificacion(db, s, venc, overdue=True)
                nuevo = calcular_proximo_vencimiento(s.dia_vencimiento, s.frecuencia, today)
                s.proximo_vencimiento = nuevo.isoformat()
                db.commit()
            elif venc <= alert_limit:
                _crear_notificacion(db, s, venc, overdue=False)

    finally:
        db.close()


def _crear_notificacion(db, servicio: models.Servicio, venc: date, overdue: bool):
    existing = db.query(models.Notificacion).filter(
        models.Notificacion.servicio_id == servicio.id,
        models.Notificacion.vencimiento_ref == venc.isoformat(),
    ).first()
    if existing:
        return

    today = date.today()
    if overdue:
        mensaje = (
            f"⚠️ '{servicio.nombre}' venció el {venc.strftime('%d/%m/%Y')} "
            f"sin registrar el pago. Monto: ${servicio.monto:,.0f}"
        )
    else:
        dias = (venc - today).days
        if dias == 0:
            cuando = "hoy"
        elif dias == 1:
            cuando = "mañana"
        else:
            cuando = f"en {dias} días ({venc.strftime('%d/%m/%Y')})"
        mensaje = f"🔔 '{servicio.nombre}' vence {cuando}. Monto estimado: ${servicio.monto:,.0f}"

    notif = models.Notificacion(
        user_id=servicio.user_id,
        servicio_id=servicio.id,
        mensaje=mensaje,
        vencimiento_ref=venc.isoformat(),
    )
    db.add(notif)
    db.commit()


async def check_vencimientos_loop():
    while True:
        try:
            await asyncio.to_thread(_check_vencimientos_sync)
        except Exception as e:
            print(f"[Scheduler] Error al chequear vencimientos: {e}")
        await asyncio.sleep(24 * 3600)
