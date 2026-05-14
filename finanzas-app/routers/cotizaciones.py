import logging
import requests
from fastapi import APIRouter
import cache

logger = logging.getLogger("finanzas.cotizaciones")
router = APIRouter(prefix="/api/cotizaciones", tags=["cotizaciones"])

_CACHE_KEY = "cotizaciones:dolares"
_TTL = 300  # 5 minutos

_NOMBRES = {
    "oficial":         "Oficial",
    "blue":            "Blue",
    "bolsa":           "MEP",
    "contadoconliqui": "CCL",
    "mayorista":       "Mayorista",
    "cripto":          "Cripto",
    "tarjeta":         "Tarjeta",
}


@router.get("")
def get_cotizaciones():
    cached = cache.get(_CACHE_KEY)
    if cached is not None:
        return cached
    try:
        resp = requests.get("https://dolarapi.com/v1/dolares", timeout=5)
        resp.raise_for_status()
        raw = resp.json()
        data = []
        for item in raw:
            casa   = item.get("casa", "").lower()
            nombre = _NOMBRES.get(casa, item.get("nombre", casa).title())
            data.append({
                "casa":   casa,
                "nombre": nombre,
                "compra": item.get("compra"),
                "venta":  item.get("venta"),
                "fecha":  item.get("fechaActualizacion", ""),
            })
        orden = ["oficial", "blue", "bolsa", "contadoconliqui", "tarjeta", "cripto", "mayorista"]
        data.sort(key=lambda x: orden.index(x["casa"]) if x["casa"] in orden else 99)
        cache.set(_CACHE_KEY, data, ttl=_TTL)
        return data
    except Exception as e:
        logger.warning("Error cotizaciones: %s", e)
        return cache.get(_CACHE_KEY) or []
