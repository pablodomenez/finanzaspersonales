import time
import requests
from fastapi import APIRouter

router = APIRouter(prefix="/api/cotizaciones", tags=["cotizaciones"])

_cache: dict = {"data": None, "ts": 0.0}
_TTL = 300  # 5 minutos

_NOMBRES = {
    "oficial": "Oficial",
    "blue":    "Blue",
    "bolsa":   "MEP",
    "contadoconliqui": "CCL",
    "mayorista": "Mayorista",
    "cripto":  "Cripto",
    "tarjeta": "Tarjeta",
}


@router.get("")
def get_cotizaciones():
    now = time.time()
    if _cache["data"] and now - _cache["ts"] < _TTL:
        return _cache["data"]
    try:
        resp = requests.get("https://dolarapi.com/v1/dolares", timeout=5)
        resp.raise_for_status()
        raw = resp.json()
        # Normalizar y filtrar los tipos más relevantes
        data = []
        for item in raw:
            casa = item.get("casa", "").lower()
            nombre = _NOMBRES.get(casa, item.get("nombre", casa).title())
            data.append({
                "casa":    casa,
                "nombre":  nombre,
                "compra":  item.get("compra"),
                "venta":   item.get("venta"),
                "fecha":   item.get("fechaActualizacion", ""),
            })
        # Orden preferido
        orden = ["oficial", "blue", "bolsa", "contadoconliqui", "tarjeta", "cripto", "mayorista"]
        data.sort(key=lambda x: orden.index(x["casa"]) if x["casa"] in orden else 99)
        _cache["data"] = data
        _cache["ts"] = now
        return data
    except Exception as e:
        print(f"[cotizaciones] Error: {e}")
        return _cache["data"] or []
