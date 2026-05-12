import io
import csv
import time
import logging
from datetime import date, datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel, Field
from database import get_db
from auth import get_current_user
import models

logger = logging.getLogger(__name__)

# ── Listas predefinidas para cuadros de mercado ───────────────────────────────

CEDEARS_PREDEFINIDOS = [
    {"ticker": "AAPL.BA",  "nombre": "Apple"},
    {"ticker": "MSFT.BA",  "nombre": "Microsoft"},
    {"ticker": "NVDA.BA",  "nombre": "NVIDIA"},
    {"ticker": "AMZN.BA",  "nombre": "Amazon"},
    {"ticker": "GOOGL.BA", "nombre": "Alphabet"},
    {"ticker": "META.BA",  "nombre": "Meta"},
    {"ticker": "TSLA.BA",  "nombre": "Tesla"},
    {"ticker": "MELI.BA",  "nombre": "MercadoLibre"},
    {"ticker": "NFLX.BA",  "nombre": "Netflix"},
    {"ticker": "BABA.BA",  "nombre": "Alibaba"},
    {"ticker": "KO.BA",    "nombre": "Coca-Cola"},
    {"ticker": "V.BA",     "nombre": "Visa"},
]

ACCIONES_PREDEFINIDAS = [
    {"ticker": "GGAL.BA",  "nombre": "Grupo Galicia"},
    {"ticker": "BMA.BA",   "nombre": "Banco Macro"},
    {"ticker": "YPFD.BA",  "nombre": "YPF"},
    {"ticker": "PAMP.BA",  "nombre": "Pampa Energía"},
    {"ticker": "TECO2.BA", "nombre": "Telecom"},
    {"ticker": "ALUA.BA",  "nombre": "Aluar"},
    {"ticker": "TXAR.BA",  "nombre": "Ternium"},
    {"ticker": "BBAR.BA",  "nombre": "BBVA Argentina"},
    {"ticker": "SUPV.BA",  "nombre": "Supervielle"},
    {"ticker": "LOMA.BA",  "nombre": "Loma Negra"},
    {"ticker": "CEPU.BA",  "nombre": "Central Puerto"},
    {"ticker": "VALO.BA",  "nombre": "Grupo Financiero Valores"},
]

CRIPTO_PREDEFINIDAS = [
    {"id": "bitcoin",      "simbolo": "BTC",  "nombre": "Bitcoin"},
    {"id": "ethereum",     "simbolo": "ETH",  "nombre": "Ethereum"},
    {"id": "tether",       "simbolo": "USDT", "nombre": "Tether"},
    {"id": "solana",       "simbolo": "SOL",  "nombre": "Solana"},
    {"id": "binancecoin",  "simbolo": "BNB",  "nombre": "BNB"},
    {"id": "ripple",       "simbolo": "XRP",  "nombre": "XRP"},
    {"id": "dogecoin",     "simbolo": "DOGE", "nombre": "Dogecoin"},
    {"id": "cardano",      "simbolo": "ADA",  "nombre": "Cardano"},
]

INDICES_US = [
    {"ticker": "^GSPC",  "simbolo": "SPX",  "nombre": "S&P 500"           },
    {"ticker": "^NDX",   "simbolo": "NDX",  "nombre": "Nasdaq 100"        },
    {"ticker": "^DJI",   "simbolo": "DJIA", "nombre": "Dow Jones"         },
    {"ticker": "^RUT",   "simbolo": "RUT",  "nombre": "Russell 2000"      },
    {"ticker": "^VIX",   "simbolo": "VIX",  "nombre": "VIX (Volatilidad)" },
]

ETFS_CEDEAR = [
    {"ticker": "SPY.BA",  "simbolo": "SPY",  "nombre": "SPDR S&P 500 (SPY)"     },
    {"ticker": "QQQ.BA",  "simbolo": "QQQ",  "nombre": "Nasdaq 100 ETF (QQQ)"   },
    {"ticker": "IWM.BA",  "simbolo": "IWM",  "nombre": "Russell 2000 ETF (IWM)" },
    {"ticker": "GLD.BA",  "simbolo": "GLD",  "nombre": "Oro ETF (GLD)"          },
    {"ticker": "XLF.BA",  "simbolo": "XLF",  "nombre": "Sector Financiero (XLF)"},
    {"ticker": "ARKK.BA", "simbolo": "ARKK", "nombre": "ARK Innovation (ARKK)"  },
]

COMMODITIES = [
    {"ticker": "GC=F",  "simbolo": "GC", "nombre": "Oro",            "unidad": "USD/oz",     "currency": "USD"},
    {"ticker": "SI=F",  "simbolo": "SI", "nombre": "Plata",          "unidad": "USD/oz",     "currency": "USD"},
    {"ticker": "CL=F",  "simbolo": "CL", "nombre": "Petróleo WTI",  "unidad": "USD/barril", "currency": "USD"},
    {"ticker": "BZ=F",  "simbolo": "BZ", "nombre": "Petróleo Brent", "unidad": "USD/barril", "currency": "USD"},
    {"ticker": "ZS=F",  "simbolo": "ZS", "nombre": "Soja",           "unidad": "USD/bu",     "currency": "USX"},
    {"ticker": "ZW=F",  "simbolo": "ZW", "nombre": "Trigo",          "unidad": "USD/bu",     "currency": "USX"},
    {"ticker": "ZC=F",  "simbolo": "ZC", "nombre": "Maíz",           "unidad": "USD/bu",     "currency": "USX"},
]

INDICES_GLOBALES = [
    {"ticker": "^GDAXI",    "simbolo": "DAX",  "nombre": "DAX (Alemania)",    "currency": "EUR"},
    {"ticker": "^FTSE",     "simbolo": "FTSE", "nombre": "FTSE 100 (UK)",     "currency": "GBP"},
    {"ticker": "^STOXX50E", "simbolo": "SX5E", "nombre": "Euro Stoxx 50",     "currency": "EUR"},
    {"ticker": "^N225",     "simbolo": "N225", "nombre": "Nikkei 225 (Japón)","currency": "JPY"},
    {"ticker": "^HSI",      "simbolo": "HSI",  "nombre": "Hang Seng (HK)",    "currency": "HKD"},
    {"ticker": "^BVSP",     "simbolo": "IBOV", "nombre": "Bovespa (Brasil)",  "currency": "BRL"},
]

_mercado_cache: dict = {"ts": 0.0, "data": None}
_MERCADO_TTL = 300  # 5 minutos

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
        "ticker": getattr(inv, "ticker", "") or "",
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
    ticker: Optional[str] = ""


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
    ticker: Optional[str] = None


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


# ── Referencias macro (sin auth para carga rápida) ───────────────────────────

@router.get("/referencias")
def get_referencias(current_user: models.User = Depends(get_current_user)):
    import requests as req

    result = {
        "usd_blue": None, "usd_oficial": None, "usd_mep": None,
        "inflacion_mensual": None, "inflacion_anualizada": None,
        "riesgo_pais": None,
    }

    # USD desde dolarapi.com
    try:
        r = req.get("https://dolarapi.com/v1/dolares", timeout=8)
        r.raise_for_status()
        for d in r.json():
            casa = d.get("casa", "")
            if casa == "blue":
                result["usd_blue"] = d.get("venta")
            elif casa == "oficial":
                result["usd_oficial"] = d.get("venta")
            elif casa == "mep":
                result["usd_mep"] = d.get("venta")
    except Exception as e:
        logger.warning(f"Error dolarapi referencias: {e}")

    # Inflación mensual desde argentinadatos.com
    try:
        r = req.get("https://api.argentinadatos.com/v1/finanzas/indices/inflacion", timeout=8)
        r.raise_for_status()
        data = r.json()
        if data:
            result["inflacion_mensual"] = data[-1].get("valor")
            last12 = data[-12:]
            factor = 1.0
            for item in last12:
                factor *= (1 + item.get("valor", 0) / 100)
            result["inflacion_anualizada"] = round((factor - 1) * 100, 1)
    except Exception as e:
        logger.warning(f"Error inflacion argentinadatos: {e}")

    # Riesgo país
    try:
        r = req.get("https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais", timeout=8)
        r.raise_for_status()
        data = r.json()
        if data:
            result["riesgo_pais"] = data[-1].get("valor")
    except Exception as e:
        logger.warning(f"Error riesgo pais argentinadatos: {e}")

    return result


# ── Cotizaciones de mercado (listas predefinidas) ─────────────────────────────

@router.get("/mercado")
def get_mercado(current_user: models.User = Depends(get_current_user)):
    import requests as req
    import concurrent.futures
    global _mercado_cache

    now = time.time()
    if _mercado_cache["data"] and (now - _mercado_cache["ts"]) < _MERCADO_TTL:
        return _mercado_cache["data"]

    result: dict = {
        "cedears": [], "acciones": [], "cripto": [],
        "indices_us": [], "etfs_cedear": [], "commodities": [], "globales": [],
        "errores": [], "ts": int(now),
    }

    # Tabla unificada: (sección, item, moneda_forzada)
    # moneda_forzada=None significa usar la del item["currency"]
    tasks = (
        [("cedears",     item, "ARS")              for item in CEDEARS_PREDEFINIDOS] +
        [("acciones",    item, "ARS")              for item in ACCIONES_PREDEFINIDAS] +
        [("indices_us",  item, "USD")              for item in INDICES_US] +
        [("etfs_cedear", item, "ARS")              for item in ETFS_CEDEAR] +
        [("commodities", item, item["currency"])   for item in COMMODITIES] +
        [("globales",    item, item["currency"])   for item in INDICES_GLOBALES]
    )

    try:
        import yfinance as yf

        def _get_price(ticker: str):
            fi = yf.Ticker(ticker).fast_info
            return float(fi.last_price), getattr(fi, "currency", "USD") or "USD"

        prices: dict = {}
        with concurrent.futures.ThreadPoolExecutor(max_workers=20) as pool:
            fut_map = {pool.submit(_get_price, item["ticker"]): item["ticker"]
                       for _, item, _ in tasks}
            for fut in concurrent.futures.as_completed(fut_map, timeout=25):
                t = fut_map[fut]
                try:
                    prices[t] = fut.result()
                except Exception:
                    prices[t] = (None, None)

        for section, item, forced_cur in tasks:
            ticker = item["ticker"]
            price, _ = prices.get(ticker, (None, None))
            cur = forced_cur
            if cur == "USX":
                price = price / 100 if price is not None else None
                cur = "USD"
            display_cur = item.get("unidad", cur)
            entry = {k: v for k, v in item.items() if k not in ("unidad", "currency")}
            entry["precio"] = round(price, 2) if price is not None else None
            entry["currency"] = display_cur
            result[section].append(entry)

    except ImportError:
        result["errores"].append("yfinance_no_instalado")
    except Exception as e:
        logger.warning(f"Error yfinance mercado: {e}")
        result["errores"].append("bolsa")

    # Crypto via CoinGecko
    try:
        ids_str = ",".join(c["id"] for c in CRIPTO_PREDEFINIDAS)
        r = req.get(
            f"https://api.coingecko.com/api/v3/simple/price?ids={ids_str}&vs_currencies=usd,ars",
            timeout=8,
            headers={"Accept": "application/json"},
        )
        r.raise_for_status()
        prices_c = r.json()
        for c in CRIPTO_PREDEFINIDAS:
            p = prices_c.get(c["id"], {})
            result["cripto"].append({**c, "precio_usd": p.get("usd"), "precio_ars": p.get("ars")})
    except Exception as e:
        logger.warning(f"Error CoinGecko mercado: {e}")
        result["errores"].append("cripto")

    _mercado_cache = {"ts": now, "data": result}
    return result


# ── Cotizaciones en tiempo real ───────────────────────────────────────────────

@router.get("/cotizaciones")
def get_cotizaciones(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    import requests as req

    result = {"dolar": [], "acciones": {}, "cripto": {}, "errores": []}

    # 1. Dólar (siempre)
    try:
        r = req.get("https://dolarapi.com/v1/dolares", timeout=8)
        r.raise_for_status()
        result["dolar"] = r.json()
    except Exception as e:
        logger.warning(f"Error dolarapi: {e}")
        result["errores"].append("dolar")

    # 2. Inversiones activas con ticker
    inv_list = (
        db.query(models.Inversion)
        .filter(
            models.Inversion.user_id == current_user.id,
            models.Inversion.estado == "activo",
        )
        .all()
    )

    bolsa_tickers = {}  # symbol -> meta
    cripto_ids = {}     # coin_id -> meta

    for inv in inv_list:
        tick = (getattr(inv, "ticker", "") or "").strip()
        if not tick:
            continue
        if inv.tipo in ("acciones", "cedears", "bonos"):
            sym = tick.upper()
            bolsa_tickers[sym] = {"inv_id": inv.id, "nombre": inv.nombre, "tipo": inv.tipo, "moneda": inv.moneda}
        elif inv.tipo == "cripto":
            cid = tick.lower()
            cripto_ids[cid] = {"inv_id": inv.id, "nombre": inv.nombre}

    # 3. Yahoo Finance (acciones / CEDEARs / bonos)
    if bolsa_tickers:
        try:
            import yfinance as yf
            for sym, meta in bolsa_tickers.items():
                try:
                    t = yf.Ticker(sym)
                    fi = t.fast_info
                    price = fi.last_price
                    currency = getattr(fi, "currency", None)
                    result["acciones"][sym] = {**meta, "ticker": sym, "precio": round(float(price), 4), "currency": currency}
                except Exception as e:
                    logger.warning(f"yfinance error {sym}: {e}")
                    result["acciones"][sym] = {**meta, "ticker": sym, "precio": None, "currency": None}
        except ImportError:
            result["errores"].append("yfinance_no_instalado")
        except Exception as e:
            logger.warning(f"Error Yahoo Finance: {e}")
            result["errores"].append("acciones")

    # 4. CoinGecko (cripto)
    if cripto_ids:
        try:
            ids_str = ",".join(cripto_ids.keys())
            r = req.get(
                f"https://api.coingecko.com/api/v3/simple/price?ids={ids_str}&vs_currencies=usd,ars",
                timeout=8,
                headers={"Accept": "application/json"},
            )
            r.raise_for_status()
            prices = r.json()
            for cid, meta in cripto_ids.items():
                if cid in prices:
                    result["cripto"][cid] = {
                        **meta, "ticker": cid,
                        "precio_usd": prices[cid].get("usd"),
                        "precio_ars": prices[cid].get("ars"),
                    }
                else:
                    result["cripto"][cid] = {**meta, "ticker": cid, "precio_usd": None, "precio_ars": None}
        except Exception as e:
            logger.warning(f"Error CoinGecko: {e}")
            result["errores"].append("cripto")

    return result


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
        notas_tesis=data.notas_tesis or "", ticker=data.ticker or "",
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
