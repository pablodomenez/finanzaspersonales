"""Módulo de caché — usa Redis si REDIS_URL está configurado, sino dict en memoria."""
import json
import os
import time
import logging
from typing import Any, Optional

logger = logging.getLogger("finanzas.cache")

_REDIS_URL = os.getenv("REDIS_URL", "")
_redis_client = None

if _REDIS_URL:
    try:
        import redis
        _redis_client = redis.from_url(_REDIS_URL, decode_responses=True, socket_connect_timeout=2)
        _redis_client.ping()
        logger.info("Redis conectado: %s", _REDIS_URL.split("@")[-1])
    except Exception as e:
        logger.warning("Redis no disponible, usando caché en memoria: %s", e)
        _redis_client = None

# Fallback: caché en memoria con TTL manual
_memory_cache: dict[str, tuple[Any, float]] = {}


def get(key: str) -> Optional[Any]:
    if _redis_client:
        try:
            val = _redis_client.get(key)
            return json.loads(val) if val is not None else None
        except Exception:
            pass

    entry = _memory_cache.get(key)
    if entry:
        value, expires_at = entry
        if expires_at == 0 or time.time() < expires_at:
            return value
        del _memory_cache[key]
    return None


def set(key: str, value: Any, ttl: int = 300) -> None:
    """Guarda en caché. ttl en segundos (0 = sin expiración)."""
    if _redis_client:
        try:
            serialized = json.dumps(value)
            if ttl > 0:
                _redis_client.setex(key, ttl, serialized)
            else:
                _redis_client.set(key, serialized)
            return
        except Exception:
            pass

    expires_at = time.time() + ttl if ttl > 0 else 0
    _memory_cache[key] = (value, expires_at)


def delete(key: str) -> None:
    if _redis_client:
        try:
            _redis_client.delete(key)
            return
        except Exception:
            pass
    _memory_cache.pop(key, None)


def clear_prefix(prefix: str) -> None:
    """Elimina todas las claves que empiecen con `prefix`."""
    if _redis_client:
        try:
            keys = _redis_client.keys(f"{prefix}*")
            if keys:
                _redis_client.delete(*keys)
            return
        except Exception:
            pass
    for k in list(_memory_cache.keys()):
        if k.startswith(prefix):
            del _memory_cache[k]
