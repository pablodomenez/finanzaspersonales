import asyncio
import time
from datetime import date, datetime, timedelta
from typing import Optional

import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import email_utils
import models
from auth import get_current_user
from database import get_db

router = APIRouter(prefix="/api/alquileres", tags=["alquileres"])

# ── Caché de índices (TTL 6 horas) ───────────────────────────────────────────

_indices_cache: dict = {"data": None, "ts": 0.0}
_INDICES_TTL = 6 * 3600


def _fecha_n_meses_atras(ref: date, meses: int) -> date:
    """Retorna la fecha exacta N meses antes de `ref`."""
    mes = ref.month - meses
    year = ref.year + (mes - 1) // 12
    mes = ((mes - 1) % 12) + 1
    ultimo = (date(year, mes % 12 + 1, 1) - timedelta(days=1)).day if mes < 12 else 31
    return date(year, mes, min(ref.day, ultimo))


def _fetch_indices_fresh() -> dict:
    today = date.today()
    result = {"ICL": None, "IPC": None, "CVS": None, "fecha": today.isoformat()}

    # ── ICL — BCRA variable 40 (índice diario de valor absoluto) ─────────────
    # Pedimos 7 meses de historia para cubrir todos los períodos de actualización.
    # El acumulado se calcula como: (valor_hoy / valor_fecha_exacta_Nm_atras - 1) * 100
    try:
        desde = _fecha_n_meses_atras(today, 7).isoformat()
        resp = requests.get(
            f"https://api.bcra.gob.ar/estadisticas/v2.0/datosvariable/40/{desde}/{today.isoformat()}",
            timeout=10,
            headers={"Accept": "application/json"},
        )
        if resp.status_code == 200:
            datos = sorted(resp.json().get("results", []), key=lambda x: x["fecha"])
            if datos:
                val_hoy = float(datos[-1]["valor"])
                fecha_dato = datos[-1]["fecha"]

                def _icl_acumulado(meses: int):
                    target = _fecha_n_meses_atras(date.fromisoformat(fecha_dato), meses).isoformat()
                    # Primer dato con fecha <= target
                    candidatos = [d for d in datos if d["fecha"] <= target]
                    if not candidatos:
                        return None
                    return round((val_hoy / float(candidatos[-1]["valor"]) - 1) * 100, 2)

                result["ICL"] = {
                    "valor_actual": round(val_hoy, 4),
                    "fecha_dato": fecha_dato,
                    "acumulado_3m": _icl_acumulado(3),
                    "acumulado_4m": _icl_acumulado(4),
                    "acumulado_6m": _icl_acumulado(6),
                }
    except Exception as e:
        print(f"[alquileres] Error ICL: {e}")

    # ── IPC — INDEC vía argentinadatos.com (variación mensual %) ─────────────
    # El endpoint devuelve la variación de cada mes. El acumulado para N meses
    # se calcula componiendo: (1+v1/100)*(1+v2/100)*...*-1
    try:
        resp_ipc = requests.get(
            "https://api.argentinadatos.com/v1/indec/ipc",
            timeout=10,
        )
        if resp_ipc.status_code == 200:
            datos_ipc = resp_ipc.json()
            if datos_ipc:
                def _ipc_acumulado(meses: int):
                    ultimos = datos_ipc[-meses:]
                    if len(ultimos) < meses:
                        return None
                    acc = 1.0
                    for d in ultimos:
                        acc *= (1 + float(d.get("valor", 0)) / 100)
                    return round((acc - 1) * 100, 2)

                result["IPC"] = {
                    "fecha_dato": datos_ipc[-1].get("fecha", ""),
                    "acumulado_3m": _ipc_acumulado(3),
                    "acumulado_4m": _ipc_acumulado(4),
                    "acumulado_6m": _ipc_acumulado(6),
                }
    except Exception as e:
        print(f"[alquileres] Error IPC: {e}")

    # ── CVS — INDEC vía argentinadatos.com (valor absoluto del índice) ────────
    # Similar al ICL: acumulado = (valor_actual / valor_Nm_atras - 1) * 100
    try:
        resp_cvs = requests.get(
            "https://api.argentinadatos.com/v1/indec/salarios",
            timeout=10,
        )
        if resp_cvs.status_code == 200:
            datos_cvs = resp_cvs.json()
            if datos_cvs:
                def _cvs_acumulado(meses: int):
                    if len(datos_cvs) <= meses:
                        return None
                    val_ultimo = float(datos_cvs[-1].get("valor", 0))
                    val_ref = float(datos_cvs[-(meses + 1)].get("valor", 1) or 1)
                    return round((val_ultimo / val_ref - 1) * 100, 2)

                result["CVS"] = {
                    "valor_actual": round(float(datos_cvs[-1].get("valor", 0)), 2),
                    "fecha_dato": datos_cvs[-1].get("fecha", ""),
                    "acumulado_3m": _cvs_acumulado(3),
                    "acumulado_4m": _cvs_acumulado(4),
                    "acumulado_6m": _cvs_acumulado(6),
                }
    except Exception as e:
        print(f"[alquileres] Error CVS: {e}")

    return result


def get_indices_cached() -> dict:
    now = time.time()
    if _indices_cache["data"] and now - _indices_cache["ts"] < _INDICES_TTL:
        return _indices_cache["data"]
    data = _fetch_indices_fresh()
    _indices_cache["data"] = data
    _indices_cache["ts"] = now
    return data


# ── Schemas ───────────────────────────────────────────────────────────────────

class AlquilerCreate(BaseModel):
    nombre: str
    direccion: Optional[str] = ""
    contraparte_nombre: Optional[str] = ""
    rol: Optional[str] = "inquilino"
    valor_actual: float
    moneda: Optional[str] = "ARS"
    fecha_inicio: str
    fecha_fin_contrato: Optional[str] = None
    dia_pago: Optional[int] = 1
    indice_actualizacion: Optional[str] = "ICL"
    porcentaje_fijo: Optional[float] = None
    periodo_actualizacion_meses: Optional[int] = 3
    proxima_actualizacion: Optional[str] = None
    valor_inmueble: Optional[float] = None
    notas: Optional[str] = ""


class AlquilerUpdate(BaseModel):
    nombre: Optional[str] = None
    direccion: Optional[str] = None
    contraparte_nombre: Optional[str] = None
    rol: Optional[str] = None
    valor_actual: Optional[float] = None
    moneda: Optional[str] = None
    fecha_inicio: Optional[str] = None
    fecha_fin_contrato: Optional[str] = None
    dia_pago: Optional[int] = None
    indice_actualizacion: Optional[str] = None
    porcentaje_fijo: Optional[float] = None
    periodo_actualizacion_meses: Optional[int] = None
    proxima_actualizacion: Optional[str] = None
    valor_inmueble: Optional[float] = None
    notas: Optional[str] = None
    activo: Optional[bool] = None


class PagoAlquilerCreate(BaseModel):
    periodo: str                        # YYYY-MM
    monto_esperado: float
    monto_pagado: Optional[float] = None
    fecha_pago: Optional[str] = None    # YYYY-MM-DD
    estado: Optional[str] = "pagado"
    comprobante: Optional[str] = None
    notas: Optional[str] = ""


class ActualizacionCreate(BaseModel):
    fecha: str                          # YYYY-MM-DD
    valor_nuevo: float
    indice_usado: str
    porcentaje_aplicado: float
    notas: Optional[str] = ""


class GastoAlquilerCreate(BaseModel):
    descripcion: str
    monto: float
    fecha: str                          # YYYY-MM-DD
    tipo: Optional[str] = "otro"        # expensa | impuesto | seguro | mantenimiento | otro
    periodo: Optional[str] = None       # YYYY-MM
    notas: Optional[str] = ""


# ── Serializers ───────────────────────────────────────────────────────────────

def _s_alquiler(a: models.Alquiler) -> dict:
    return {
        "id": a.id,
        "nombre": a.nombre,
        "direccion": a.direccion,
        "contraparte_nombre": a.contraparte_nombre,
        "rol": a.rol,
        "valor_actual": round(a.valor_actual, 2),
        "moneda": a.moneda,
        "fecha_inicio": a.fecha_inicio,
        "fecha_fin_contrato": a.fecha_fin_contrato,
        "dia_pago": a.dia_pago,
        "indice_actualizacion": a.indice_actualizacion,
        "porcentaje_fijo": a.porcentaje_fijo,
        "periodo_actualizacion_meses": a.periodo_actualizacion_meses,
        "proxima_actualizacion": a.proxima_actualizacion,
        "valor_inmueble": a.valor_inmueble,
        "notas": a.notas,
        "activo": a.activo,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


def _s_pago(p: models.PagoAlquiler) -> dict:
    return {
        "id": p.id,
        "alquiler_id": p.alquiler_id,
        "periodo": p.periodo,
        "monto_esperado": round(p.monto_esperado, 2),
        "monto_pagado": round(p.monto_pagado, 2) if p.monto_pagado is not None else None,
        "fecha_pago": p.fecha_pago,
        "estado": p.estado,
        "comprobante": p.comprobante,
        "notas": p.notas,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def _s_actualizacion(u: models.ActualizacionAlquiler) -> dict:
    return {
        "id": u.id,
        "alquiler_id": u.alquiler_id,
        "fecha": u.fecha,
        "valor_anterior": round(u.valor_anterior, 2),
        "valor_nuevo": round(u.valor_nuevo, 2),
        "indice_usado": u.indice_usado,
        "porcentaje_aplicado": round(u.porcentaje_aplicado, 2),
        "notas": u.notas,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


def _s_gasto(g: models.GastoAlquiler) -> dict:
    return {
        "id": g.id,
        "alquiler_id": g.alquiler_id,
        "descripcion": g.descripcion,
        "monto": round(g.monto, 2),
        "fecha": g.fecha,
        "tipo": g.tipo,
        "periodo": g.periodo,
        "notas": g.notas,
        "created_at": g.created_at.isoformat() if g.created_at else None,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _calcular_proxima_actualizacion(desde: str, meses: int) -> str:
    """Calcula la fecha de próxima actualización sumando `meses` a `desde`."""
    try:
        d = date.fromisoformat(desde)
    except ValueError:
        d = date.today()
    # Avanzar N meses
    mes = d.month + meses
    year = d.year + (mes - 1) // 12
    mes = ((mes - 1) % 12) + 1
    ultimo_dia = (date(year, mes % 12 + 1, 1) - timedelta(days=1)).day if mes < 12 else 31
    dia = min(d.day, ultimo_dia)
    return date(year, mes, dia).isoformat()


def _calcular_porcentaje_con_indice(alquiler: models.Alquiler) -> Optional[float]:
    """Devuelve el porcentaje a aplicar según índice vigente."""
    if alquiler.indice_actualizacion == "fijo":
        return alquiler.porcentaje_fijo

    indices = get_indices_cached()
    meses = alquiler.periodo_actualizacion_meses or 3
    key = {3: "acumulado_3m", 4: "acumulado_4m", 6: "acumulado_6m"}.get(meses)
    if not key:
        return None

    indice_data = indices.get(alquiler.indice_actualizacion)
    if indice_data and indice_data.get(key) is not None:
        return indice_data[key]
    return None


# ── Endpoints: alquileres ─────────────────────────────────────────────────────

@router.get("")
def listar_alquileres(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    alquileres = (
        db.query(models.Alquiler)
        .filter(models.Alquiler.user_id == current_user.id)
        .order_by(models.Alquiler.activo.desc(), models.Alquiler.nombre)
        .all()
    )
    return [_s_alquiler(a) for a in alquileres]


@router.post("", status_code=201)
def crear_alquiler(
    data: AlquilerCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    proxima = data.proxima_actualizacion
    if not proxima and data.fecha_inicio:
        proxima = _calcular_proxima_actualizacion(data.fecha_inicio, data.periodo_actualizacion_meses or 3)

    a = models.Alquiler(
        user_id=current_user.id,
        nombre=data.nombre,
        direccion=data.direccion or "",
        contraparte_nombre=data.contraparte_nombre or "",
        rol=data.rol or "inquilino",
        valor_actual=data.valor_actual,
        moneda=data.moneda or "ARS",
        fecha_inicio=data.fecha_inicio,
        fecha_fin_contrato=data.fecha_fin_contrato,
        dia_pago=data.dia_pago or 1,
        indice_actualizacion=data.indice_actualizacion or "ICL",
        porcentaje_fijo=data.porcentaje_fijo,
        periodo_actualizacion_meses=data.periodo_actualizacion_meses or 3,
        proxima_actualizacion=proxima,
        valor_inmueble=data.valor_inmueble,
        notas=data.notas or "",
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return _s_alquiler(a)


@router.put("/{alquiler_id}")
def actualizar_alquiler(
    alquiler_id: int,
    data: AlquilerUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    a = db.query(models.Alquiler).filter(
        models.Alquiler.id == alquiler_id,
        models.Alquiler.user_id == current_user.id,
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Alquiler no encontrado")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(a, field, value)
    db.commit()
    db.refresh(a)
    return _s_alquiler(a)


@router.delete("/{alquiler_id}", status_code=204)
def eliminar_alquiler(
    alquiler_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    a = db.query(models.Alquiler).filter(
        models.Alquiler.id == alquiler_id,
        models.Alquiler.user_id == current_user.id,
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Alquiler no encontrado")
    db.delete(a)
    db.commit()


# ── Endpoints: índices ────────────────────────────────────────────────────────

@router.get("/indices")
def get_indices():
    return get_indices_cached()


# ── Endpoints: pagos ──────────────────────────────────────────────────────────

@router.get("/{alquiler_id}/pagos")
def listar_pagos(
    alquiler_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _get_alquiler_or_404(alquiler_id, current_user.id, db)
    pagos = (
        db.query(models.PagoAlquiler)
        .filter(models.PagoAlquiler.alquiler_id == alquiler_id)
        .order_by(models.PagoAlquiler.periodo.desc())
        .all()
    )
    return [_s_pago(p) for p in pagos]


@router.post("/{alquiler_id}/pagos", status_code=201)
def registrar_pago(
    alquiler_id: int,
    data: PagoAlquilerCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    a = _get_alquiler_or_404(alquiler_id, current_user.id, db)

    # Upsert: si ya existe pago para este período, actualiza
    existing = db.query(models.PagoAlquiler).filter(
        models.PagoAlquiler.alquiler_id == alquiler_id,
        models.PagoAlquiler.periodo == data.periodo,
    ).first()

    if existing:
        existing.monto_esperado = data.monto_esperado
        existing.monto_pagado = data.monto_pagado
        existing.fecha_pago = data.fecha_pago
        existing.estado = data.estado or "pagado"
        if data.comprobante is not None:
            existing.comprobante = data.comprobante
        existing.notas = data.notas or ""
        db.commit()
        db.refresh(existing)
        return _s_pago(existing)

    pago = models.PagoAlquiler(
        alquiler_id=a.id,
        periodo=data.periodo,
        monto_esperado=data.monto_esperado,
        monto_pagado=data.monto_pagado,
        fecha_pago=data.fecha_pago,
        estado=data.estado or "pagado",
        comprobante=data.comprobante,
        notas=data.notas or "",
    )
    db.add(pago)
    db.commit()
    db.refresh(pago)
    return _s_pago(pago)


@router.delete("/pagos/{pago_id}", status_code=204)
def eliminar_pago(
    pago_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    pago = db.query(models.PagoAlquiler).join(models.Alquiler).filter(
        models.PagoAlquiler.id == pago_id,
        models.Alquiler.user_id == current_user.id,
    ).first()
    if not pago:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    db.delete(pago)
    db.commit()


# ── Endpoints: actualizaciones de precio ─────────────────────────────────────

@router.get("/{alquiler_id}/actualizaciones")
def listar_actualizaciones(
    alquiler_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _get_alquiler_or_404(alquiler_id, current_user.id, db)
    items = (
        db.query(models.ActualizacionAlquiler)
        .filter(models.ActualizacionAlquiler.alquiler_id == alquiler_id)
        .order_by(models.ActualizacionAlquiler.fecha.desc())
        .all()
    )
    return [_s_actualizacion(u) for u in items]


@router.post("/{alquiler_id}/actualizaciones", status_code=201)
def registrar_actualizacion(
    alquiler_id: int,
    data: ActualizacionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    a = _get_alquiler_or_404(alquiler_id, current_user.id, db)

    upd = models.ActualizacionAlquiler(
        alquiler_id=a.id,
        fecha=data.fecha,
        valor_anterior=a.valor_actual,
        valor_nuevo=data.valor_nuevo,
        indice_usado=data.indice_usado,
        porcentaje_aplicado=data.porcentaje_aplicado,
        notas=data.notas or "",
    )
    db.add(upd)

    # Actualizar el valor actual del alquiler y la próxima actualización
    a.valor_actual = data.valor_nuevo
    a.proxima_actualizacion = _calcular_proxima_actualizacion(data.fecha, a.periodo_actualizacion_meses or 3)

    db.commit()
    db.refresh(upd)
    return _s_actualizacion(upd)


@router.delete("/actualizaciones/{actualizacion_id}", status_code=204)
def eliminar_actualizacion(
    actualizacion_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    item = db.query(models.ActualizacionAlquiler).join(models.Alquiler).filter(
        models.ActualizacionAlquiler.id == actualizacion_id,
        models.Alquiler.user_id == current_user.id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Actualización no encontrada")
    db.delete(item)
    db.commit()


# ── Endpoints: gastos asociados ───────────────────────────────────────────────

@router.get("/{alquiler_id}/gastos")
def listar_gastos(
    alquiler_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _get_alquiler_or_404(alquiler_id, current_user.id, db)
    items = (
        db.query(models.GastoAlquiler)
        .filter(models.GastoAlquiler.alquiler_id == alquiler_id)
        .order_by(models.GastoAlquiler.fecha.desc())
        .all()
    )
    return [_s_gasto(g) for g in items]


@router.post("/{alquiler_id}/gastos", status_code=201)
def crear_gasto(
    alquiler_id: int,
    data: GastoAlquilerCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    a = _get_alquiler_or_404(alquiler_id, current_user.id, db)
    g = models.GastoAlquiler(
        alquiler_id=a.id,
        descripcion=data.descripcion,
        monto=data.monto,
        fecha=data.fecha,
        tipo=data.tipo or "otro",
        periodo=data.periodo,
        notas=data.notas or "",
    )
    db.add(g)
    db.commit()
    db.refresh(g)
    return _s_gasto(g)


@router.delete("/gastos/{gasto_id}", status_code=204)
def eliminar_gasto(
    gasto_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    g = db.query(models.GastoAlquiler).join(models.Alquiler).filter(
        models.GastoAlquiler.id == gasto_id,
        models.Alquiler.user_id == current_user.id,
    ).first()
    if not g:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    db.delete(g)
    db.commit()


# ── Endpoints: proyección y comparador ───────────────────────────────────────

@router.get("/{alquiler_id}/proyeccion")
def proyeccion(
    alquiler_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    a = _get_alquiler_or_404(alquiler_id, current_user.id, db)
    indices = get_indices_cached()
    meses = a.periodo_actualizacion_meses or 3

    resultado = {
        "valor_actual": round(a.valor_actual, 2),
        "proxima_actualizacion": a.proxima_actualizacion,
        "periodo_meses": meses,
        "proyecciones": {},
    }

    key = {3: "acumulado_3m", 4: "acumulado_4m", 6: "acumulado_6m"}.get(meses, "acumulado_3m")

    for nombre_indice in ("ICL", "IPC", "CVS"):
        datos = indices.get(nombre_indice)
        if datos and datos.get(key) is not None:
            pct = datos[key]
            resultado["proyecciones"][nombre_indice] = {
                "porcentaje": round(pct, 2),
                "valor_proyectado": round(a.valor_actual * (1 + pct / 100), 2),
            }

    # Porcentaje fijo del contrato
    if a.indice_actualizacion == "fijo" and a.porcentaje_fijo:
        resultado["proyecciones"]["fijo"] = {
            "porcentaje": round(a.porcentaje_fijo, 2),
            "valor_proyectado": round(a.valor_actual * (1 + a.porcentaje_fijo / 100), 2),
        }

    return resultado


@router.get("/{alquiler_id}/roi")
def roi(
    alquiler_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    a = _get_alquiler_or_404(alquiler_id, current_user.id, db)
    if a.rol != "propietario":
        raise HTTPException(status_code=400, detail="El ROI solo aplica para propietarios")
    if not a.valor_inmueble or a.valor_inmueble <= 0:
        raise HTTPException(status_code=400, detail="Ingresá el valor del inmueble para calcular el ROI")

    # Alquiler mensual en ARS
    renta_mensual = a.valor_actual
    renta_anual = renta_mensual * 12

    # Total gastos del año actual
    today = date.today()
    gastos_año = (
        db.query(models.GastoAlquiler)
        .filter(
            models.GastoAlquiler.alquiler_id == a.id,
            models.GastoAlquiler.fecha >= f"{today.year}-01-01",
        )
        .all()
    )
    total_gastos = sum(g.monto for g in gastos_año)

    renta_neta = renta_anual - total_gastos
    roi_bruto = (renta_anual / a.valor_inmueble) * 100
    roi_neto = (renta_neta / a.valor_inmueble) * 100

    return {
        "valor_inmueble": round(a.valor_inmueble, 2),
        "renta_mensual": round(renta_mensual, 2),
        "renta_anual_bruta": round(renta_anual, 2),
        "gastos_anuales": round(total_gastos, 2),
        "renta_anual_neta": round(renta_neta, 2),
        "roi_bruto_pct": round(roi_bruto, 2),
        "roi_neto_pct": round(roi_neto, 2),
        "moneda": a.moneda,
    }


# ── Endpoints: notificaciones ─────────────────────────────────────────────────

@router.get("/notificaciones")
def get_notificaciones(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    notifs = (
        db.query(models.NotificacionAlquiler)
        .filter(models.NotificacionAlquiler.user_id == current_user.id)
        .order_by(models.NotificacionAlquiler.created_at.desc())
        .limit(50)
        .all()
    )
    return [_s_notif(n) for n in notifs]


@router.patch("/notificaciones/{notif_id}/leer", status_code=200)
def marcar_leida(
    notif_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    n = db.query(models.NotificacionAlquiler).filter(
        models.NotificacionAlquiler.id == notif_id,
        models.NotificacionAlquiler.user_id == current_user.id,
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    n.leida = True
    db.commit()
    return {"ok": True}


@router.patch("/notificaciones/leer-todas", status_code=200)
def marcar_todas_leidas(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db.query(models.NotificacionAlquiler).filter(
        models.NotificacionAlquiler.user_id == current_user.id,
        models.NotificacionAlquiler.leida == False,
    ).update({"leida": True})
    db.commit()
    return {"ok": True}


@router.post("/check-alertas")
def check_alertas_endpoint(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _check_alquileres_sync()
    return {"ok": True}


# ── Helpers internos ──────────────────────────────────────────────────────────

def _get_alquiler_or_404(alquiler_id: int, user_id: int, db: Session) -> models.Alquiler:
    a = db.query(models.Alquiler).filter(
        models.Alquiler.id == alquiler_id,
        models.Alquiler.user_id == user_id,
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Alquiler no encontrado")
    return a


def _s_notif(n: models.NotificacionAlquiler) -> dict:
    return {
        "id": n.id,
        "alquiler_id": n.alquiler_id,
        "mensaje": n.mensaje,
        "tipo": n.tipo,
        "leida": n.leida,
        "ref": n.ref,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


# ── Scheduler ─────────────────────────────────────────────────────────────────

def _check_alquileres_sync():
    from database import SessionLocal
    db = SessionLocal()
    try:
        today = date.today()

        alquileres = db.query(models.Alquiler).filter(models.Alquiler.activo == True).all()

        for a in alquileres:
            # Alerta de actualización de precio (30 días antes)
            if a.proxima_actualizacion:
                try:
                    prox = date.fromisoformat(a.proxima_actualizacion)
                    dias_para_actualizacion = (prox - today).days
                    if 0 <= dias_para_actualizacion <= 30:
                        _crear_notif_alquiler(
                            db, a,
                            ref=f"actualizacion_{a.proxima_actualizacion}",
                            tipo="actualizacion",
                            dias=dias_para_actualizacion,
                        )
                except ValueError:
                    pass

            # Alerta de vencimiento del contrato (60 días antes)
            if a.fecha_fin_contrato:
                try:
                    fin = date.fromisoformat(a.fecha_fin_contrato)
                    dias_para_fin = (fin - today).days
                    if 0 <= dias_para_fin <= 60:
                        _crear_notif_alquiler(
                            db, a,
                            ref=f"fin_contrato_{a.fecha_fin_contrato}",
                            tipo="fin_contrato",
                            dias=dias_para_fin,
                        )
                except ValueError:
                    pass

            # Alerta de pago mensual (verificar si el mes actual está sin pagar)
            periodo_actual = today.strftime("%Y-%m")
            if today.day >= (a.dia_pago or 1):
                pago_mes = db.query(models.PagoAlquiler).filter(
                    models.PagoAlquiler.alquiler_id == a.id,
                    models.PagoAlquiler.periodo == periodo_actual,
                    models.PagoAlquiler.estado == "pagado",
                ).first()
                if not pago_mes:
                    dias_atraso = today.day - (a.dia_pago or 1)
                    _crear_notif_alquiler(
                        db, a,
                        ref=f"pago_{periodo_actual}",
                        tipo="pago_pendiente",
                        dias=dias_atraso,
                    )
    finally:
        db.close()


def _crear_notif_alquiler(db, alquiler: models.Alquiler, ref: str, tipo: str, dias: int):
    existing = db.query(models.NotificacionAlquiler).filter(
        models.NotificacionAlquiler.alquiler_id == alquiler.id,
        models.NotificacionAlquiler.ref == ref,
    ).first()
    if existing:
        return

    if tipo == "actualizacion":
        if dias == 0:
            cuando = "hoy"
        elif dias == 1:
            cuando = "mañana"
        else:
            cuando = f"en {dias} días"
        mensaje = f"📈 '{alquiler.nombre}': actualización de precio {cuando} ({alquiler.proxima_actualizacion}). Índice: {alquiler.indice_actualizacion}"
    elif tipo == "fin_contrato":
        if dias == 0:
            cuando = "hoy"
        else:
            cuando = f"en {dias} días"
        mensaje = f"📋 '{alquiler.nombre}': el contrato vence {cuando} ({alquiler.fecha_fin_contrato})"
    elif tipo == "pago_pendiente":
        if dias == 0:
            mensaje = f"🏠 '{alquiler.nombre}': el pago de {alquiler.proxima_actualizacion or 'este mes'} vence hoy (día {alquiler.dia_pago})"
        elif dias > 0:
            mensaje = f"⚠️ '{alquiler.nombre}': pago de alquiler con {dias} días de atraso. Monto: ${alquiler.valor_actual:,.0f}"
        else:
            return
    else:
        mensaje = f"🔔 '{alquiler.nombre}': recordatorio de alquiler"

    notif = models.NotificacionAlquiler(
        user_id=alquiler.user_id,
        alquiler_id=alquiler.id,
        mensaje=mensaje,
        tipo=tipo,
        ref=ref,
    )
    db.add(notif)
    db.commit()

    user = db.query(models.User).filter(models.User.id == alquiler.user_id).first()
    if user:
        email_utils.send_alquiler_reminder(
            to=user.email,
            name=user.name,
            nombre_alquiler=alquiler.nombre,
            tipo=tipo,
            dias=dias,
            monto=alquiler.valor_actual,
            fecha_ref=alquiler.proxima_actualizacion or alquiler.fecha_fin_contrato or "",
        )


async def check_alquileres_loop():
    while True:
        try:
            await asyncio.to_thread(_check_alquileres_sync)
        except Exception as e:
            print(f"[Scheduler] Error al chequear alquileres: {e}")
        await asyncio.sleep(3600 * 24)
