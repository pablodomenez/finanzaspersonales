import csv
import io
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import extract
from pydantic import BaseModel, Field
from database import get_db
from auth import get_current_user
from limiter import limiter
import models

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


class TransactionCreate(BaseModel):
    amount: float = Field(gt=0)
    type: models.TransactionType
    category_id: int
    description: Optional[str] = ""
    date: Optional[datetime] = None
    payment_method: Optional[str] = None


class TransactionUpdate(BaseModel):
    amount: Optional[float] = Field(default=None, gt=0)
    type: Optional[models.TransactionType] = None
    category_id: Optional[int] = None
    description: Optional[str] = None
    date: Optional[datetime] = None
    payment_method: Optional[str] = None


def _serialize(t: models.Transaction) -> dict:
    return {
        "id": t.id,
        "amount": t.amount,
        "type": t.type,
        "description": t.description,
        "date": t.date.isoformat(),
        "payment_method": t.payment_method,
        "category": {"id": t.category.id, "name": t.category.name, "icon": t.category.icon},
    }


@router.get("")
def list_transactions(
    month: Optional[int] = None,
    year: Optional[int] = None,
    type: Optional[models.TransactionType] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = (
        db.query(models.Transaction)
        .options(joinedload(models.Transaction.category))
        .filter(models.Transaction.user_id == current_user.id)
    )
    if month:
        if not 1 <= month <= 12:
            raise HTTPException(status_code=422, detail="El mes debe ser entre 1 y 12")
        q = q.filter(extract("month", models.Transaction.date) == month)
    if year:
        if not 2000 <= year <= 2100:
            raise HTTPException(status_code=422, detail="Año fuera de rango")
        q = q.filter(extract("year", models.Transaction.date) == year)
    if type:
        q = q.filter(models.Transaction.type == type)
    return [_serialize(t) for t in q.order_by(models.Transaction.date.desc()).all()]


@router.post("", status_code=201)
def create_transaction(
    data: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not db.query(models.Category).filter(models.Category.id == data.category_id).first():
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    t = models.Transaction(
        user_id=current_user.id,
        amount=data.amount,
        type=data.type,
        category_id=data.category_id,
        description=data.description or "",
        date=data.date or datetime.utcnow(),
        payment_method=data.payment_method,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    # Cargar relación explícitamente para el response
    db.query(models.Transaction).options(joinedload(models.Transaction.category)).filter(models.Transaction.id == t.id).first()
    return _serialize(t)


@router.put("/{transaction_id}")
def update_transaction(
    transaction_id: int,
    data: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    t = db.query(models.Transaction).filter(
        models.Transaction.id == transaction_id,
        models.Transaction.user_id == current_user.id,
    ).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(t, field, value)
    db.commit()
    db.refresh(t)
    return _serialize(t)


MAX_IMPORT_SIZE = 5 * 1024 * 1024  # 5 MB


@router.post("/import", status_code=200)
@limiter.limit("10/minute")
async def import_transactions(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Importa transacciones desde un CSV.
    Columnas requeridas: fecha, descripcion, monto, tipo
    Columnas opcionales: categoria, forma_pago

    tipo acepta: gasto/expense/g/e   o   ingreso/income/i
    fecha acepta: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY
    """
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="El archivo debe ser un CSV")

    content = await file.read(MAX_IMPORT_SIZE + 1)
    if len(content) > MAX_IMPORT_SIZE:
        raise HTTPException(status_code=413, detail="El archivo no puede superar 5 MB")
    try:
        text = content.decode("utf-8-sig")  # utf-8-sig maneja el BOM de Excel
    except UnicodeDecodeError:
        try:
            text = content.decode("latin-1")
        except Exception:
            raise HTTPException(status_code=400, detail="No se pudo leer el archivo. Asegurate de guardarlo en UTF-8 o Latin-1.")

    # Detectar delimitador
    sample = text[:2000]
    delimiter = ";" if sample.count(";") > sample.count(",") else ","

    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)

    # Normalizar nombres de columnas
    def normalize(s: str) -> str:
        return s.strip().lower().replace(" ", "_").replace("á","a").replace("é","e").replace("í","i").replace("ó","o").replace("ú","u")

    COL_ALIASES = {
        "fecha":       ["fecha", "date", "fecha_operacion", "fecha_transaccion"],
        "descripcion": ["descripcion", "description", "concepto", "detalle", "motivo"],
        "monto":       ["monto", "amount", "importe", "valor"],
        "tipo":        ["tipo", "type", "movimiento"],
        "categoria":   ["categoria", "category", "rubro"],
        "forma_pago":  ["forma_pago", "payment_method", "medio_pago", "medio"],
    }

    # Categorías por defecto mapeadas por nombre
    categories = {c["name"].lower(): c["id"] for c in [
        {"id": 5, "name": "Comida"}, {"id": 6, "name": "Transporte"},
        {"id": 7, "name": "Vivienda"}, {"id": 8, "name": "Salud"},
        {"id": 9, "name": "Educación"}, {"id": 10, "name": "Entretenimiento"},
        {"id": 11, "name": "Ropa"}, {"id": 12, "name": "Ahorro"},
        {"id": 13, "name": "Servicios"}, {"id": 14, "name": "Otros gastos"},
        {"id": 15, "name": "Mascotas"}, {"id": 17, "name": "Combustible"},
        {"id": 1, "name": "Sueldo"},
        {"id": 2, "name": "Freelance"}, {"id": 3, "name": "Inversiones"},
        {"id": 4, "name": "Otros ingresos"},
    ]}

    def parse_date(s: str) -> datetime:
        s = s.strip()
        for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d", "%d/%m/%y"):
            try:
                return datetime.strptime(s, fmt)
            except ValueError:
                continue
        raise ValueError(f"Fecha no reconocida: {s}")

    def parse_tipo(s: str) -> models.TransactionType:
        s = s.strip().lower()
        if s in ("gasto", "expense", "g", "e", "débito", "debito", "egreso"):
            return models.TransactionType.expense
        if s in ("ingreso", "income", "i", "crédito", "credito"):
            return models.TransactionType.income
        raise ValueError(f"Tipo no reconocido: {s}")

    if reader.fieldnames is None:
        raise HTTPException(status_code=400, detail="El CSV está vacío o no tiene encabezados")

    norm_fields = {normalize(f): f for f in reader.fieldnames if f}

    def get_col(row: dict, key: str) -> Optional[str]:
        for alias in COL_ALIASES.get(key, [key]):
            if alias in norm_fields:
                val = row.get(norm_fields[alias], "").strip()
                return val if val else None
        return None

    # Verificar columnas mínimas
    required = ["fecha", "monto", "tipo"]
    missing = [k for k in required if not any(a in norm_fields for a in COL_ALIASES[k])]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Columnas requeridas no encontradas: {', '.join(missing)}. "
                   f"Columnas detectadas: {', '.join(reader.fieldnames)}",
        )

    created, errors = [], []

    for i, row in enumerate(reader, start=2):  # start=2 porque fila 1 es encabezado
        try:
            fecha_str  = get_col(row, "fecha")
            monto_str  = get_col(row, "monto")
            tipo_str   = get_col(row, "tipo")
            desc_str   = get_col(row, "descripcion") or ""
            cat_str    = get_col(row, "categoria") or ""
            pago_str   = get_col(row, "forma_pago") or ""

            if not fecha_str or not monto_str or not tipo_str:
                errors.append({"fila": i, "error": "Fila incompleta (fecha, monto o tipo vacíos)"})
                continue

            fecha = parse_date(fecha_str)
            tipo  = parse_tipo(tipo_str)

            # Monto: quitar símbolos y convertir comas decimales
            monto_clean = monto_str.replace("$", "").replace(" ", "").replace(".", "").replace(",", ".")
            monto = abs(float(monto_clean))
            if monto <= 0:
                errors.append({"fila": i, "error": f"Monto inválido: {monto_str}"})
                continue

            # Resolver categoría
            cat_id = 14  # Otros gastos por defecto
            if tipo == models.TransactionType.income:
                cat_id = 4  # Otros ingresos por defecto
            if cat_str:
                cat_id = categories.get(cat_str.lower(), cat_id)

            t = models.Transaction(
                user_id=current_user.id,
                amount=monto,
                type=tipo,
                category_id=cat_id,
                description=desc_str,
                date=fecha,
                payment_method=pago_str or None,
            )
            db.add(t)
            created.append(i)
        except Exception as e:
            errors.append({"fila": i, "error": str(e)})

    if created:
        db.commit()

    return {
        "imported": len(created),
        "errors": errors[:20],  # máximo 20 errores para no saturar
        "total_rows": len(created) + len(errors),
    }


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    t = db.query(models.Transaction).filter(
        models.Transaction.id == transaction_id,
        models.Transaction.user_id == current_user.id,
    ).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    db.delete(t)
    db.commit()
