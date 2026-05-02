import io
import csv
from datetime import date, datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel, Field
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/api/inversiones", tags=["inversiones"])

TIPO_ICON = {
    "plazo_fijo": "🏦", "fci": "📊", "acciones": "📈", "cedears": "🌎",
    "bonos": "📜", "cripto": "₿", "dolar": "💵", "inmueble": "🏠", "otros": "💼",
}
TIPO_LABEL = {
    "plazo_fijo": "Plazo Fijo", "fci": "Fondo Común (FCI)", "acciones": "Acciones",
    "cedears": "CEDEARs", "bonos": "Bonos / ONs", "cripto": "Criptomonedas",
    "dolar": "Dólar / USD", "inmueble": "Inmueble", "otros": "Otros",
}


def _dias_a_venc(fecha_str: Optional[str]) -> Optional[int]:
    if not fecha_str:
        return None
    try:
        return (date.fromisoformat(fecha_str) - date.today()).days
    except ValueError:
        return None


def _serialize(inv: models.Inversion) -> dict:
    rendimiento = round(inv.valor_actual - inv.monto_invertido, 2)
    rend_pct = round(rendimiento / inv.monto_invertido * 100, 2) if inv.monto_invertido else 0

    try:
        dias_inv = max(0, (date.today() - date.fromisoformat(inv.fecha_inicio)).days)
    except Exception:
        dias_inv = 0

    total_div_ars = total_div_usd = 0.0
    try:
        for d in inv.dividendos:
            if d.moneda == "USD":
                total_div_usd += d.monto
            else:
                total_div_ars += d.monto
    except Exception:
        pass

    return {
        "id": inv.id,
        "tipo": inv.tipo,
        "tipo_label": TIPO_LABEL.get(inv.tipo, inv.tipo),
        "icono": TIPO_ICON.get(inv.tipo, "💼"),
        "nombre": inv.nombre,
        "moneda": inv.moneda,
        "monto_invertido": inv.monto_invertido,
        "valor_actual": inv.valor_actual,
        "rendimiento": rendimiento,
        "rendimiento_pct": rend_pct,
        "fecha_inicio": inv.fecha_inicio,
        "fecha_vencimiento": inv.fecha_vencimiento,
        "dias_vencimiento": _dias_a_venc(inv.fecha_vencimiento),
        "tasa_anual": inv.tasa_anual,
        "estado": inv.estado,
        "notas": inv.notas,
        "notas_tesis": getattr(inv, "notas_tesis", "") or "",
        "dias_invertidos": dias_inv,
        "total_dividendos_ars": round(total_div_ars, 2),
        "total_dividendos_usd": round(total_div_usd, 2),
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
    }


def _serialize_historico(h: models.HistoricoInversion) -> dict:
    return {"id": h.id, "valor": h.valor, "fecha": h.fecha, "created_at": h.created_at.isoformat()}


def _serialize_dividendo(d: models.DividendoInversion) -> dict:
    return {
        "id": d.id, "monto": d.monto, "moneda": d.moneda,
        "fecha": d.fecha, "tipo": d.tipo, "notas": d.notas,
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }


# ── Schemas ───────────────────────────────────────────────────────────────────

class PerfilCreate(BaseModel):
    perfil: str
    puntaje: int
    respuestas: Optional[str] = ""


class InversionCreate(BaseModel):
    tipo: str = Field(min_length=1)
    nombre: str = Field(min_length=1)
    moneda: str = "ARS"
    monto_invertido: float = Field(gt=0)
    valor_actual: Optional[float] = None
    fecha_inicio: str
    fecha_vencimiento: Optional[str] = None
    tasa_anual: Optional[float] = None
    notas: Optional[str] = ""
    notas_tesis: Optional[str] = ""


class InversionUpdate(BaseModel):
    tipo: Optional[str] = None
    nombre: Optional[str] = None
    moneda: Optional[str] = None
    monto_invertido: Optional[float] = None
    valor_actual: Optional[float] = None
    fecha_inicio: Optional[str] = None
    fecha_vencimiento: Optional[str] = None
    tasa_anual: Optional[float] = None
    estado: Optional[str] = None
    notas: Optional[str] = None
    notas_tesis: Optional[str] = None


class HistoricoCreate(BaseModel):
    valor: float = Field(gt=0)
    fecha: str


class DividendoCreate(BaseModel):
    monto: float = Field(gt=0)
    moneda: str = "ARS"
    fecha: str
    tipo: str = "dividendo"
    notas: Optional[str] = ""


# ── Perfil ────────────────────────────────────────────────────────────────────

@router.get("/perfil")
def get_perfil(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    p = db.query(models.InversorPerfil).filter(models.InversorPerfil.user_id == current_user.id).first()
    if not p:
        return None
    return {"id": p.id, "perfil": p.perfil, "puntaje": p.puntaje, "respuestas": p.respuestas,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None}


@router.post("/perfil")
def save_perfil(data: PerfilCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    p = db.query(models.InversorPerfil).filter(models.InversorPerfil.user_id == current_user.id).first()
    if p:
        p.perfil = data.perfil
        p.puntaje = data.puntaje
        p.respuestas = data.respuestas or ""
        p.updated_at = datetime.utcnow()
    else:
        p = models.InversorPerfil(user_id=current_user.id, perfil=data.perfil,
                                  puntaje=data.puntaje, respuestas=data.respuestas or "")
        db.add(p)
    db.commit()
    db.refresh(p)
    return {"perfil": p.perfil, "puntaje": p.puntaje}


# ── Resumen ───────────────────────────────────────────────────────────────────

@router.get("/resumen")
def resumen(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    items = (
        db.query(models.Inversion)
        .options(joinedload(models.Inversion.dividendos))
        .filter(models.Inversion.user_id == current_user.id, models.Inversion.estado == "activo")
        .all()
    )

    def totales(moneda: str):
        inv = [i for i in items if i.moneda == moneda]
        invertido = sum(i.monto_invertido for i in inv)
        actual = sum(i.valor_actual for i in inv)
        rend = round(actual - invertido, 2)
        rend_pct = round(rend / invertido * 100, 2) if invertido else 0
        # Dividendos cobrados
        div = 0.0
        for i in inv:
            for d in i.dividendos:
                if d.moneda == moneda:
                    div += d.monto
        return {"cantidad": len(inv), "invertido": round(invertido, 2), "actual": round(actual, 2),
                "rendimiento": rend, "rendimiento_pct": rend_pct, "dividendos": round(div, 2)}

    por_tipo = {}
    for inv in items:
        k = inv.tipo
        if k not in por_tipo:
            por_tipo[k] = {"tipo": k, "label": TIPO_LABEL.get(k, k), "icono": TIPO_ICON.get(k, "💼"),
                           "count": 0, "ars": 0.0, "usd": 0.0}
        if inv.moneda == "USD":
            por_tipo[k]["usd"] = round(por_tipo[k]["usd"] + inv.valor_actual, 2)
        else:
            por_tipo[k]["ars"] = round(por_tipo[k]["ars"] + inv.valor_actual, 2)
        por_tipo[k]["count"] += 1

    # Alertas de vencimiento
    alertas = []
    for inv in items:
        dias = _dias_a_venc(inv.fecha_vencimiento)
        if dias is not None and dias <= 7:
            alertas.append({"id": inv.id, "nombre": inv.nombre, "tipo": inv.tipo,
                            "icono": TIPO_ICON.get(inv.tipo, "💼"),
                            "dias_vencimiento": dias, "monto": inv.valor_actual,
                            "moneda": inv.moneda, "fecha_vencimiento": inv.fecha_vencimiento})

    return {"ars": totales("ARS"), "usd": totales("USD"),
            "total_activos": len(items), "por_tipo": list(por_tipo.values()),
            "alertas_vencimiento": alertas}


# ── Exportar CSV (ruta estática antes de /{id}) ───────────────────────────────

@router.get("/exportar-csv")
def exportar_csv(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    items = (
        db.query(models.Inversion)
        .options(joinedload(models.Inversion.dividendos))
        .filter(models.Inversion.user_id == current_user.id)
        .order_by(models.Inversion.fecha_inicio.desc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Tipo", "Nombre", "Moneda", "Monto Invertido", "Valor Actual",
                     "Rendimiento $", "Rendimiento %", "Dividendos Cobrados",
                     "Fecha Inicio", "Fecha Vencimiento", "TNA %", "Estado",
                     "Dias Invertidos", "Notas", "Tesis"])
    for inv in items:
        rend = round(inv.valor_actual - inv.monto_invertido, 2)
        rend_pct = round(rend / inv.monto_invertido * 100, 2) if inv.monto_invertido else 0
        div = sum(d.monto for d in inv.dividendos if d.moneda == inv.moneda)
        try:
            dias_inv = (date.today() - date.fromisoformat(inv.fecha_inicio)).days
        except Exception:
            dias_inv = ""
        writer.writerow([inv.id, TIPO_LABEL.get(inv.tipo, inv.tipo), inv.nombre, inv.moneda,
                         inv.monto_invertido, inv.valor_actual, rend, rend_pct,
                         round(div, 2), inv.fecha_inicio, inv.fecha_vencimiento or "",
                         inv.tasa_anual or "", inv.estado, dias_inv,
                         inv.notas, getattr(inv, "notas_tesis", "") or ""])

    content = output.getvalue().encode("utf-8-sig")
    return StreamingResponse(
        io.BytesIO(content),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=inversiones.csv"},
    )


# ── Dividendos (DELETE estático antes de /{id}) ───────────────────────────────

@router.delete("/dividendos/{div_id}", status_code=204)
def delete_dividendo(div_id: int, db: Session = Depends(get_db),
                     current_user: models.User = Depends(get_current_user)):
    d = db.query(models.DividendoInversion).filter(
        models.DividendoInversion.id == div_id,
        models.DividendoInversion.user_id == current_user.id,
    ).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dividendo no encontrado")
    db.delete(d)
    db.commit()


# ── CRUD inversiones ──────────────────────────────────────────────────────────

@router.get("")
def list_inversiones(estado: Optional[str] = None, db: Session = Depends(get_db),
                     current_user: models.User = Depends(get_current_user)):
    q = (
        db.query(models.Inversion)
        .options(joinedload(models.Inversion.dividendos))
        .filter(models.Inversion.user_id == current_user.id)
    )
    if estado:
        q = q.filter(models.Inversion.estado == estado)
    items = q.order_by(models.Inversion.estado.asc(), models.Inversion.fecha_inicio.desc()).all()
    return [_serialize(i) for i in items]


@router.post("", status_code=201)
def create_inversion(data: InversionCreate, db: Session = Depends(get_db),
                     current_user: models.User = Depends(get_current_user)):
    valor = data.valor_actual if data.valor_actual is not None else data.monto_invertido
    inv = models.Inversion(
        user_id=current_user.id, tipo=data.tipo, nombre=data.nombre, moneda=data.moneda,
        monto_invertido=data.monto_invertido, valor_actual=valor,
        fecha_inicio=data.fecha_inicio, fecha_vencimiento=data.fecha_vencimiento,
        tasa_anual=data.tasa_anual, notas=data.notas or "",
        notas_tesis=data.notas_tesis or "",
    )
    db.add(inv)
    db.flush()
    # Registrar valor inicial en historico
    db.add(models.HistoricoInversion(user_id=current_user.id, inversion_id=inv.id,
                                     valor=valor, fecha=data.fecha_inicio))
    db.commit()
    db.refresh(inv)
    return _serialize(inv)


@router.put("/{inv_id}")
def update_inversion(inv_id: int, data: InversionUpdate, db: Session = Depends(get_db),
                     current_user: models.User = Depends(get_current_user)):
    inv = db.query(models.Inversion).filter(
        models.Inversion.id == inv_id, models.Inversion.user_id == current_user.id
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Inversión no encontrada")

    nuevo_valor = data.valor_actual
    valor_cambio = nuevo_valor is not None and nuevo_valor != inv.valor_actual

    for field, val in data.model_dump(exclude_none=True).items():
        setattr(inv, field, val)

    if valor_cambio:
        db.add(models.HistoricoInversion(
            user_id=current_user.id, inversion_id=inv.id,
            valor=nuevo_valor, fecha=date.today().isoformat(),
        ))

    db.commit()
    db.refresh(inv)
    return _serialize(inv)


@router.delete("/{inv_id}", status_code=204)
def delete_inversion(inv_id: int, db: Session = Depends(get_db),
                     current_user: models.User = Depends(get_current_user)):
    inv = db.query(models.Inversion).filter(
        models.Inversion.id == inv_id, models.Inversion.user_id == current_user.id
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Inversión no encontrada")
    db.delete(inv)
    db.commit()


# ── Histórico ─────────────────────────────────────────────────────────────────

@router.get("/{inv_id}/historico")
def get_historico(inv_id: int, db: Session = Depends(get_db),
                  current_user: models.User = Depends(get_current_user)):
    inv = db.query(models.Inversion).filter(
        models.Inversion.id == inv_id, models.Inversion.user_id == current_user.id
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Inversión no encontrada")
    items = (
        db.query(models.HistoricoInversion)
        .filter(models.HistoricoInversion.inversion_id == inv_id)
        .order_by(models.HistoricoInversion.fecha.asc())
        .all()
    )
    return [_serialize_historico(h) for h in items]


@router.post("/{inv_id}/historico", status_code=201)
def add_historico(inv_id: int, data: HistoricoCreate, db: Session = Depends(get_db),
                  current_user: models.User = Depends(get_current_user)):
    inv = db.query(models.Inversion).filter(
        models.Inversion.id == inv_id, models.Inversion.user_id == current_user.id
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Inversión no encontrada")
    h = models.HistoricoInversion(user_id=current_user.id, inversion_id=inv_id,
                                  valor=data.valor, fecha=data.fecha)
    db.add(h)
    # Actualizar valor_actual si es la entrada más reciente
    ultimo = (db.query(models.HistoricoInversion)
              .filter(models.HistoricoInversion.inversion_id == inv_id)
              .order_by(models.HistoricoInversion.fecha.desc()).first())
    if not ultimo or data.fecha >= ultimo.fecha:
        inv.valor_actual = data.valor
    db.commit()
    db.refresh(h)
    return _serialize_historico(h)


# ── Dividendos ────────────────────────────────────────────────────────────────

@router.get("/{inv_id}/dividendos")
def list_dividendos(inv_id: int, db: Session = Depends(get_db),
                    current_user: models.User = Depends(get_current_user)):
    inv = db.query(models.Inversion).filter(
        models.Inversion.id == inv_id, models.Inversion.user_id == current_user.id
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Inversión no encontrada")
    items = (
        db.query(models.DividendoInversion)
        .filter(models.DividendoInversion.inversion_id == inv_id)
        .order_by(models.DividendoInversion.fecha.desc())
        .all()
    )
    return [_serialize_dividendo(d) for d in items]


@router.post("/{inv_id}/dividendos", status_code=201)
def add_dividendo(inv_id: int, data: DividendoCreate, db: Session = Depends(get_db),
                  current_user: models.User = Depends(get_current_user)):
    inv = db.query(models.Inversion).filter(
        models.Inversion.id == inv_id, models.Inversion.user_id == current_user.id
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Inversión no encontrada")
    d = models.DividendoInversion(
        user_id=current_user.id, inversion_id=inv_id,
        monto=data.monto, moneda=data.moneda, fecha=data.fecha,
        tipo=data.tipo, notas=data.notas or "",
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return _serialize_dividendo(d)
