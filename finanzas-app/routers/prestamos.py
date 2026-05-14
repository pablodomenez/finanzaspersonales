from datetime import date, timedelta
from calendar import monthrange
from typing import Optional
import time
import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
import models

_uva_cache: dict = {"valor": None, "fecha": None, "ts": 0.0}
_UVA_TTL = 3600  # 1 hora (la UVA se publica una vez por día)

router = APIRouter(prefix="/api/prestamos", tags=["prestamos"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class PrestamoCreate(BaseModel):
    nombre: str = Field(min_length=1)
    tipo: str = "personal"               # hipotecario|personal|vehiculo|prendario|uva|otro
    entidad: str = ""
    numero_operacion: str = ""           # Op n° del banco
    monto_original: float = Field(gt=0)
    moneda: str = "ARS"
    tasa_nominal_anual: float = Field(default=0.0, ge=0)
    sistema_amortizacion: str = "frances"  # frances|aleman|cuota_fija
    cuotas_totales: int = Field(ge=1, le=600)
    fecha_inicio: str                    # YYYY-MM-DD (primera cuota)
    dia_pago: int = Field(default=10, ge=1, le=28)
    cargos_mensuales: float = Field(default=0.0, ge=0)  # seguros + gastos administrativos
    cuota_desde: int = Field(default=1, ge=1)           # cuota desde la que empezás a registrar
    notas: str = ""


class PrestamoUpdate(BaseModel):
    nombre: Optional[str] = None
    entidad: Optional[str] = None
    numero_operacion: Optional[str] = None
    dia_pago: Optional[int] = Field(None, ge=1, le=28)
    cargos_mensuales: Optional[float] = Field(None, ge=0)
    notas: Optional[str] = None
    activo: Optional[bool] = None


class PagarCuotaRequest(BaseModel):
    fecha_pago: Optional[str] = None          # YYYY-MM-DD, default hoy
    # valores reales del banco (si se proveen, reemplazan los calculados al crear el préstamo)
    capital_real:  Optional[float] = Field(None, ge=0)
    interes_real:  Optional[float] = Field(None, ge=0)
    cargos_real:   Optional[float] = Field(None, ge=0)
    capital_uva:   Optional[float] = Field(None, ge=0)  # solo préstamos UVA
    interes_uva:   Optional[float] = Field(None, ge=0)  # solo préstamos UVA
    notas: str = ""


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fecha_cuota(fecha_inicio: str, numero: int, dia_pago: int) -> str:
    """Calcula la fecha de vencimiento de la cuota N (1-indexed)."""
    inicio = date.fromisoformat(fecha_inicio)
    mes = inicio.month + (numero - 1)
    anio = inicio.year + (mes - 1) // 12
    mes = (mes - 1) % 12 + 1
    dia = min(dia_pago, monthrange(anio, mes)[1])
    return date(anio, mes, dia).isoformat()


def _calcular_cuotas(
    monto: float,
    tna: float,
    n: int,
    fecha_inicio: str,
    dia_pago: int,
    cargos: float,
    sistema: str,
) -> list[dict]:
    tasa_m = tna / 100 / 12
    cuotas = []

    if sistema == "frances":
        if tasa_m > 0:
            cuota_capital_interes = monto * tasa_m / (1 - (1 + tasa_m) ** -n)
        else:
            cuota_capital_interes = monto / n
        saldo = monto
        for i in range(1, n + 1):
            interes = round(saldo * tasa_m, 2)
            capital = round(cuota_capital_interes - interes, 2)
            saldo = round(max(saldo - capital, 0), 2)
            cuotas.append({
                "numero_cuota": i,
                "capital": capital,
                "interes": interes,
                "cargos": round(cargos, 2),
                "monto_total": round(cuota_capital_interes + cargos, 2),
                "saldo_pendiente": saldo,
                "fecha_vencimiento": _fecha_cuota(fecha_inicio, i, dia_pago),
            })

    elif sistema == "aleman":
        capital_fijo = round(monto / n, 2)
        saldo = monto
        for i in range(1, n + 1):
            interes = round(saldo * tasa_m, 2)
            saldo = round(max(saldo - capital_fijo, 0), 2)
            cuotas.append({
                "numero_cuota": i,
                "capital": capital_fijo,
                "interes": interes,
                "cargos": round(cargos, 2),
                "monto_total": round(capital_fijo + interes + cargos, 2),
                "saldo_pendiente": saldo,
                "fecha_vencimiento": _fecha_cuota(fecha_inicio, i, dia_pago),
            })

    else:  # cuota_fija: divide el monto sin interés calculado
        cuota_base = round(monto / n, 2)
        saldo = monto
        for i in range(1, n + 1):
            saldo = round(max(saldo - cuota_base, 0), 2)
            cuotas.append({
                "numero_cuota": i,
                "capital": cuota_base,
                "interes": 0.0,
                "cargos": round(cargos, 2),
                "monto_total": round(cuota_base + cargos, 2),
                "saldo_pendiente": saldo,
                "fecha_vencimiento": _fecha_cuota(fecha_inicio, i, dia_pago),
            })

    return cuotas


def _serialize_prestamo(p: models.Prestamo) -> dict:
    pagos = p.pagos or []
    pagadas = [c for c in pagos if c.estado == "pagado"]
    pendientes = [c for c in pagos if c.estado != "pagado"]
    capital_pagado = round(sum(c.capital for c in pagadas), 2)
    interes_pagado = round(sum(c.interes for c in pagadas), 2)
    total_pagado = round(sum(c.monto_total for c in pagadas), 2)
    saldo_actual = p.monto_original
    if pagadas:
        ultima = max(pagadas, key=lambda c: c.numero_cuota)
        saldo_actual = round(ultima.saldo_pendiente, 2)

    proxima = None
    for c in sorted(pendientes, key=lambda c: c.numero_cuota):
        proxima = {
            "numero_cuota": c.numero_cuota,
            "fecha_vencimiento": c.fecha_vencimiento,
            "monto_total": c.monto_total,
            "capital": c.capital,
            "interes": c.interes,
            "cargos": c.cargos,
        }
        break

    return {
        "id": p.id,
        "nombre": p.nombre,
        "tipo": p.tipo,
        "entidad": p.entidad,
        "numero_operacion": p.numero_operacion or "",
        "monto_original": p.monto_original,
        "moneda": p.moneda,
        "tasa_nominal_anual": p.tasa_nominal_anual,
        "sistema_amortizacion": p.sistema_amortizacion,
        "cuotas_totales": p.cuotas_totales,
        "cuotas_pagadas": len(pagadas),
        "fecha_inicio": p.fecha_inicio,
        "dia_pago": p.dia_pago,
        "cargos_mensuales": p.cargos_mensuales or 0.0,
        "notas": p.notas,
        "activo": p.activo,
        "capital_pagado": capital_pagado,
        "interes_pagado": interes_pagado,
        "total_pagado": total_pagado,
        "saldo_actual": saldo_actual,
        "proxima_cuota": proxima,
    }


def _serialize_cuota(c: models.PagoPrestamo) -> dict:
    return {
        "id": c.id,
        "prestamo_id": c.prestamo_id,
        "numero_cuota": c.numero_cuota,
        "fecha_vencimiento": c.fecha_vencimiento,
        "fecha_pago": c.fecha_pago,
        "monto_total": c.monto_total,
        "capital": c.capital,
        "interes": c.interes,
        "cargos": c.cargos,
        "capital_uva": c.capital_uva,
        "interes_uva": c.interes_uva,
        "saldo_pendiente": c.saldo_pendiente,
        "estado": c.estado,
        "notas": c.notas,
    }


def _actualizar_estados(prestamo_id: int, db: Session):
    """Marca como 'atrasado' las cuotas pendientes con vencimiento pasado."""
    hoy = date.today().isoformat()
    cuotas = (
        db.query(models.PagoPrestamo)
        .filter(
            models.PagoPrestamo.prestamo_id == prestamo_id,
            models.PagoPrestamo.estado == "pendiente",
            models.PagoPrestamo.fecha_vencimiento < hoy,
        )
        .all()
    )
    for c in cuotas:
        c.estado = "atrasado"
    if cuotas:
        db.commit()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/uva")
def get_uva():
    """Devuelve el valor actual de la UVA desde la API del BCRA (cache 1h)."""
    now = time.time()
    if _uva_cache["valor"] and now - _uva_cache["ts"] < _UVA_TTL:
        return _uva_cache

    try:
        hoy = date.today().isoformat()
        desde = (date.today() - timedelta(days=5)).isoformat()
        url = f"https://api.bcra.gob.ar/estadisticas/v2.0/datosvariable/4/{desde}/{hoy}"
        resp = requests.get(url, timeout=5, verify=False)
        resp.raise_for_status()
        resultados = resp.json().get("results", [])
        if not resultados:
            raise ValueError("Sin datos")
        ultimo = resultados[-1]
        _uva_cache["valor"] = round(float(ultimo["valor"]), 4)
        _uva_cache["fecha"] = ultimo["fecha"]
        _uva_cache["ts"] = now
        return _uva_cache
    except Exception as e:
        print(f"[uva] Error BCRA: {e}, intentando argentinadatos…")

    try:
        resp2 = requests.get("https://api.argentinadatos.com/v1/finanzas/indices/uva", timeout=5)
        resp2.raise_for_status()
        data = resp2.json()
        if not data:
            raise ValueError("Sin datos")
        ultimo = data[-1]
        _uva_cache["valor"] = round(float(ultimo["valor"]), 4)
        _uva_cache["fecha"] = ultimo["fecha"]
        _uva_cache["ts"] = now
        return _uva_cache
    except Exception as e2:
        print(f"[uva] Error argentinadatos: {e2}")
        if _uva_cache["valor"]:
            return _uva_cache
        raise HTTPException(status_code=503, detail="No se pudo obtener la cotización UVA")


@router.get("")
def listar_prestamos(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    prestamos = (
        db.query(models.Prestamo)
        .filter(models.Prestamo.user_id == current_user.id)
        .order_by(models.Prestamo.created_at.desc())
        .all()
    )
    for p in prestamos:
        _actualizar_estados(p.id, db)
    return [_serialize_prestamo(p) for p in prestamos]


@router.post("", status_code=201)
def crear_prestamo(
    data: PrestamoCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    p = models.Prestamo(
        user_id=current_user.id,
        nombre=data.nombre,
        tipo=data.tipo,
        entidad=data.entidad,
        numero_operacion=data.numero_operacion,
        monto_original=data.monto_original,
        moneda=data.moneda,
        tasa_nominal_anual=data.tasa_nominal_anual,
        sistema_amortizacion=data.sistema_amortizacion,
        cuotas_totales=data.cuotas_totales,
        fecha_inicio=data.fecha_inicio,
        dia_pago=data.dia_pago,
        cargos_mensuales=data.cargos_mensuales,
        notas=data.notas,
    )
    db.add(p)
    db.flush()

    cuotas = _calcular_cuotas(
        data.monto_original,
        data.tasa_nominal_anual,
        data.cuotas_totales,
        data.fecha_inicio,
        data.dia_pago,
        data.cargos_mensuales,
        data.sistema_amortizacion,
    )
    hoy = date.today().isoformat()
    cuota_desde = max(1, min(data.cuota_desde, data.cuotas_totales))
    for c in cuotas:
        num = c["numero_cuota"]
        if num < cuota_desde:
            estado = "pagado"
            fecha_pago = c["fecha_vencimiento"]
        else:
            estado = "atrasado" if c["fecha_vencimiento"] < hoy else "pendiente"
            fecha_pago = None
        db.add(models.PagoPrestamo(
            prestamo_id=p.id,
            user_id=current_user.id,
            numero_cuota=num,
            fecha_vencimiento=c["fecha_vencimiento"],
            fecha_pago=fecha_pago,
            monto_total=c["monto_total"],
            capital=c["capital"],
            interes=c["interes"],
            cargos=c["cargos"],
            saldo_pendiente=c["saldo_pendiente"],
            estado=estado,
        ))

    db.commit()
    db.refresh(p)
    return _serialize_prestamo(p)


@router.put("/{prestamo_id}")
def editar_prestamo(
    prestamo_id: int,
    data: PrestamoUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    p = db.query(models.Prestamo).filter(
        models.Prestamo.id == prestamo_id,
        models.Prestamo.user_id == current_user.id,
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
    if data.nombre is not None:
        p.nombre = data.nombre
    if data.entidad is not None:
        p.entidad = data.entidad
    if data.numero_operacion is not None:
        p.numero_operacion = data.numero_operacion
    if data.dia_pago is not None:
        p.dia_pago = data.dia_pago
    if data.cargos_mensuales is not None:
        p.cargos_mensuales = data.cargos_mensuales
    if data.notas is not None:
        p.notas = data.notas
    if data.activo is not None:
        p.activo = data.activo
    db.commit()
    db.refresh(p)
    return _serialize_prestamo(p)


@router.delete("/{prestamo_id}", status_code=204)
def eliminar_prestamo(
    prestamo_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    p = db.query(models.Prestamo).filter(
        models.Prestamo.id == prestamo_id,
        models.Prestamo.user_id == current_user.id,
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
    db.delete(p)
    db.commit()


@router.get("/resumen")
def resumen_prestamos(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    prestamos = (
        db.query(models.Prestamo)
        .filter(models.Prestamo.user_id == current_user.id, models.Prestamo.activo == True)
        .all()
    )
    for p in prestamos:
        _actualizar_estados(p.id, db)

    total_deuda = 0.0
    cuotas_atrasadas = 0
    proximas = []

    for p in prestamos:
        pagadas = [c for c in p.pagos if c.estado == "pagado"]
        if pagadas:
            ultima = max(pagadas, key=lambda c: c.numero_cuota)
            total_deuda += ultima.saldo_pendiente
        else:
            total_deuda += p.monto_original

        cuotas_atrasadas += sum(1 for c in p.pagos if c.estado == "atrasado")

        for c in sorted(p.pagos, key=lambda c: c.numero_cuota):
            if c.estado != "pagado":
                proximas.append({
                    "prestamo_id": p.id,
                    "prestamo_nombre": p.nombre,
                    "numero_cuota": c.numero_cuota,
                    "fecha_vencimiento": c.fecha_vencimiento,
                    "monto_total": c.monto_total,
                    "estado": c.estado,
                })
                break

    proximas.sort(key=lambda x: x["fecha_vencimiento"])

    return {
        "total_deuda": round(total_deuda, 2),
        "cuotas_atrasadas": cuotas_atrasadas,
        "proximas_cuotas": proximas[:5],
    }


@router.get("/{prestamo_id}/cuotas")
def listar_cuotas(
    prestamo_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    p = db.query(models.Prestamo).filter(
        models.Prestamo.id == prestamo_id,
        models.Prestamo.user_id == current_user.id,
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
    _actualizar_estados(prestamo_id, db)
    cuotas = (
        db.query(models.PagoPrestamo)
        .filter(models.PagoPrestamo.prestamo_id == prestamo_id)
        .order_by(models.PagoPrestamo.numero_cuota)
        .all()
    )
    return [_serialize_cuota(c) for c in cuotas]


@router.post("/{prestamo_id}/cuotas/{numero_cuota}/pagar")
def pagar_cuota(
    prestamo_id: int,
    numero_cuota: int,
    data: PagarCuotaRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    p = db.query(models.Prestamo).filter(
        models.Prestamo.id == prestamo_id,
        models.Prestamo.user_id == current_user.id,
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    cuota = db.query(models.PagoPrestamo).filter(
        models.PagoPrestamo.prestamo_id == prestamo_id,
        models.PagoPrestamo.numero_cuota == numero_cuota,
    ).first()
    if not cuota:
        raise HTTPException(status_code=404, detail="Cuota no encontrada")
    if cuota.estado == "pagado":
        raise HTTPException(status_code=400, detail="La cuota ya fue pagada")

    cuota.estado = "pagado"
    cuota.fecha_pago = data.fecha_pago or date.today().isoformat()

    # Sobrescribir con valores reales del banco si se proveen
    if data.capital_real is not None:
        cuota.capital = data.capital_real
    if data.interes_real is not None:
        cuota.interes = data.interes_real
    if data.cargos_real is not None:
        cuota.cargos = data.cargos_real
    if data.capital_uva is not None:
        cuota.capital_uva = data.capital_uva
    if data.interes_uva is not None:
        cuota.interes_uva = data.interes_uva

    # Recalcular monto_total si se actualizó algún componente
    if any(x is not None for x in [data.capital_real, data.interes_real, data.cargos_real]):
        cuota.monto_total = round(cuota.capital + cuota.interes + cuota.cargos, 2)

    cuota.notas = data.notas
    db.commit()
    return _serialize_cuota(cuota)


@router.delete("/{prestamo_id}/cuotas/{numero_cuota}/pagar", status_code=200)
def deshacer_pago(
    prestamo_id: int,
    numero_cuota: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Revierte el pago de una cuota (la devuelve a pendiente o atrasado)."""
    p = db.query(models.Prestamo).filter(
        models.Prestamo.id == prestamo_id,
        models.Prestamo.user_id == current_user.id,
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    cuota = db.query(models.PagoPrestamo).filter(
        models.PagoPrestamo.prestamo_id == prestamo_id,
        models.PagoPrestamo.numero_cuota == numero_cuota,
    ).first()
    if not cuota:
        raise HTTPException(status_code=404, detail="Cuota no encontrada")

    hoy = date.today().isoformat()
    cuota.estado = "atrasado" if cuota.fecha_vencimiento < hoy else "pendiente"
    cuota.fecha_pago = None
    cuota.notas = ""
    db.commit()
    return _serialize_cuota(cuota)
