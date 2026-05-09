import os
import secrets
import time
from urllib.parse import urlencode
from dotenv import load_dotenv
import requests as http_req
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from database import get_db
import models
from auth import create_access_token

load_dotenv()

router = APIRouter(prefix="/api/auth", tags=["google-auth"])

# ── In-memory stores (proceso único; en multi-worker usar Redis) ───────────────
# state -> expiry (epoch). TTL: 10 minutos para completar el flujo OAuth.
_oauth_states: dict[str, float] = {}

# code -> {user_id, name, picture, terms_accepted, expires}. TTL: 60 segundos.
_oauth_codes: dict[str, dict] = {}

_STATE_TTL = 600  # 10 minutos
_CODE_TTL = 60    # 60 segundos


def _cleanup_expired():
    now = time.time()
    expired_states = [k for k, exp in _oauth_states.items() if exp < now]
    for k in expired_states:
        del _oauth_states[k]
    expired_codes = [k for k, v in _oauth_codes.items() if v["expires"] < now]
    for k in expired_codes:
        del _oauth_codes[k]


@router.get("/google")
def google_login():
    _cleanup_expired()
    state = secrets.token_urlsafe(32)
    _oauth_states[state] = time.time() + _STATE_TTL

    params = {
        "client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
        "redirect_uri": os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback"),
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
        "state": state,
    }
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}")


@router.get("/google/callback")
def google_callback(
    code: str = None,
    state: str = None,
    error: str = None,
    db: Session = Depends(get_db),
):
    if error or not code:
        return RedirectResponse("/login.html?error=google_cancelado")

    # Validar CSRF state
    _cleanup_expired()
    if not state or state not in _oauth_states or _oauth_states[state] < time.time():
        return RedirectResponse("/login.html?error=google_state_invalido")
    del _oauth_states[state]

    token_resp = http_req.post("https://oauth2.googleapis.com/token", data={
        "code": code,
        "client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET", ""),
        "redirect_uri": os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback"),
        "grant_type": "authorization_code",
    })
    if not token_resp.ok:
        return RedirectResponse("/login.html?error=google_token")

    access_token = token_resp.json().get("access_token")

    userinfo_resp = http_req.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    if not userinfo_resp.ok:
        return RedirectResponse("/login.html?error=google_userinfo")

    info = userinfo_resp.json()
    google_id = info.get("sub")
    email = info.get("email", "")
    name = info.get("name") or email.split("@")[0]
    picture = info.get("picture", "")

    # Buscar por google_id primero
    user = db.query(models.User).filter(models.User.google_id == google_id).first()

    if not user:
        existing = db.query(models.User).filter(models.User.email == email).first()
        if existing:
            # Si la cuenta fue creada con contraseña, NO vincular automáticamente.
            # El usuario debe iniciar sesión con contraseña.
            if existing.hashed_password and not existing.google_id:
                return RedirectResponse("/login.html?error=email_ya_registrado")
            # Si ya tenía google_id de otro sub (raro), rechazar igualmente.
            if existing.google_id and existing.google_id != google_id:
                return RedirectResponse("/login.html?error=cuenta_vinculada_otro_google")
            # Solo vincular si el usuario no tiene contraseña (creado sin password)
            existing.google_id = google_id
            user = existing
        else:
            user = models.User(
                email=email,
                name=name,
                hashed_password=None,
                google_id=google_id,
            )
            db.add(user)

    db.commit()
    db.refresh(user)

    # Emitir un código de un solo uso en lugar del JWT en la URL
    exchange_code = secrets.token_urlsafe(32)
    _oauth_codes[exchange_code] = {
        "user_id": user.id,
        "name": user.name,
        "picture": picture,
        "terms_accepted": "true" if user.terms_accepted_at is not None else "false",
        "expires": time.time() + _CODE_TTL,
    }

    return RedirectResponse(f"/oauth-callback.html?code={exchange_code}")


@router.get("/google/exchange")
def exchange_oauth_code(code: str, db: Session = Depends(get_db)):
    """Canjea el código de un solo uso por un JWT. El código expira en 60 segundos."""
    _cleanup_expired()
    data = _oauth_codes.pop(code, None)
    if not data or data["expires"] < time.time():
        raise HTTPException(status_code=400, detail="Código inválido o expirado")

    user = db.query(models.User).filter(models.User.id == data["user_id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    jwt_token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": jwt_token,
        "token_type": "bearer",
        "user_name": data["name"],
        "picture": data["picture"],
        "terms_accepted": data["terms_accepted"] == "true",
    }
