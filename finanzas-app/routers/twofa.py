"""Autenticación de dos factores (TOTP — Google Authenticator compatible)."""
import base64
import io
import secrets
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user, create_access_token, decode_refresh_token
import models

router = APIRouter(prefix="/api/auth/2fa", tags=["2fa"])


def _get_pyotp():
    try:
        import pyotp
        return pyotp
    except ImportError:
        raise HTTPException(status_code=501, detail="pyotp no está instalado en el servidor")


def _qr_png_b64(uri: str) -> str:
    """Genera un QR code en base64 PNG."""
    try:
        import qrcode
        img = qrcode.make(uri)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode()
    except ImportError:
        return ""


@router.post("/setup", summary="Iniciar configuración 2FA — devuelve secret y QR")
def setup_2fa(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.totp_enabled:
        raise HTTPException(status_code=400, detail="2FA ya está activado")

    pyotp = _get_pyotp()
    secret = pyotp.random_base32()

    # Guardar el secret provisionalmente (aún no activado)
    db.query(models.User).filter(models.User.id == current_user.id).update(
        {"totp_secret": secret, "totp_enabled": False}
    )
    db.commit()

    totp = pyotp.TOTP(secret)
    uri  = totp.provisioning_uri(name=current_user.email, issuer_name="FinanzasApp")

    return {
        "secret": secret,
        "uri": uri,
        "qr_b64": _qr_png_b64(uri),
    }


class VerifySetupRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)


@router.post("/verify-setup", summary="Verificar y activar 2FA")
def verify_setup(
    data: VerifySetupRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pyotp = _get_pyotp()
    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="Primero iniciá la configuración con /setup")

    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Código inválido o expirado")

    db.query(models.User).filter(models.User.id == current_user.id).update({"totp_enabled": True})
    db.commit()
    return {"ok": True, "message": "2FA activado correctamente"}


class DisableRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)


@router.post("/disable", summary="Desactivar 2FA")
def disable_2fa(
    data: DisableRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pyotp = _get_pyotp()
    if not current_user.totp_enabled:
        raise HTTPException(status_code=400, detail="2FA no está activado")

    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Código inválido")

    db.query(models.User).filter(models.User.id == current_user.id).update(
        {"totp_enabled": False, "totp_secret": None}
    )
    db.commit()
    return {"ok": True}


class VerifyLoginRequest(BaseModel):
    pending_token: str
    code: str = Field(min_length=6, max_length=6)


@router.post("/verify-login", summary="Verificar código TOTP durante el login")
def verify_login(
    data: VerifyLoginRequest,
    db: Session = Depends(get_db),
):
    """Cuando el login retorna pending_2fa=True, el frontend envía el token pendiente
    junto con el código TOTP. Si es válido, devuelve el token de acceso real."""
    from auth import SECRET_KEY, ALGORITHM
    from jose import jwt, JWTError

    try:
        payload = jwt.decode(data.pending_token, SECRET_KEY, algorithms=[ALGORITHM])
        if not payload.get("pending_2fa"):
            raise HTTPException(status_code=400, detail="Token no es de verificación 2FA")
        user_id = int(payload.get("sub", 0))
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user or not user.totp_enabled:
        raise HTTPException(status_code=400, detail="Usuario no encontrado o 2FA no activo")

    import pyotp
    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Código inválido")

    from auth import create_access_token, create_refresh_token
    access  = create_access_token({"sub": str(user.id)})
    refresh = create_refresh_token(user.id)
    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "user_name": user.name,
        "terms_accepted": user.terms_accepted_at is not None,
        "onboarding_done": bool(user.onboarding_done),
    }
