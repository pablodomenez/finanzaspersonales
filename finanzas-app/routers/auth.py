import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field
from database import get_db
from limiter import limiter
import models
import auth as auth_utils
import email_utils

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=8)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_name: str
    terms_accepted: bool
    onboarding_done: bool = True


@router.post("/register", response_model=TokenResponse)
@limiter.limit("5/minute")
def register(request: Request, data: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == data.email).first():
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    user = models.User(
        email=data.email,
        name=data.name,
        hashed_password=auth_utils.hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    access = auth_utils.create_access_token({"sub": str(user.id)})
    refresh = auth_utils.create_refresh_token(user.id)
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user_name=user.name,
        terms_accepted=False,
        onboarding_done=False,
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user or not auth_utils.verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    if user.totp_enabled:
        # Devolver flag para que el frontend solicite el código TOTP
        pending_token = auth_utils.create_access_token(
            {"sub": str(user.id), "pending_2fa": True},
            expires_delta=__import__("datetime").timedelta(minutes=5),
        )
        return TokenResponse(
            access_token=pending_token,
            refresh_token="",
            user_name=user.name,
            terms_accepted=(user.terms_accepted_at is not None),
            onboarding_done=bool(user.onboarding_done),
        )
    access = auth_utils.create_access_token({"sub": str(user.id)})
    refresh = auth_utils.create_refresh_token(user.id)
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user_name=user.name,
        terms_accepted=(user.terms_accepted_at is not None),
        onboarding_done=bool(user.onboarding_done),
    )


@router.post("/accept-terms", status_code=200)
def accept_terms(
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    db.query(models.User).filter(models.User.id == current_user.id).update(
        {"terms_accepted_at": datetime.utcnow()}
    )
    db.commit()
    return {"ok": True}


@router.get("/me")
def me(current_user: models.User = Depends(auth_utils.get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "terms_accepted": current_user.terms_accepted_at is not None,
        "onboarding_done": bool(current_user.onboarding_done),
        "totp_enabled": bool(current_user.totp_enabled),
        "is_admin": bool(current_user.is_admin),
    }


@router.post("/complete-onboarding", status_code=200)
def complete_onboarding(
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    db.query(models.User).filter(models.User.id == current_user.id).update({"onboarding_done": True})
    db.commit()
    return {"ok": True}


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/refresh")
def refresh_token(data: RefreshRequest, db: Session = Depends(get_db)):
    user_id = auth_utils.decode_refresh_token(data.refresh_token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Refresh token inválido o expirado")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    access = auth_utils.create_access_token({"sub": str(user.id)})
    refresh = auth_utils.create_refresh_token(user.id)
    return {"access_token": access, "refresh_token": refresh, "token_type": "bearer"}


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


@router.post("/forgot-password", status_code=200)
@limiter.limit("3/minute")
def forgot_password(request: Request, data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == data.email).first()
    # Siempre responder OK para no revelar si el email existe
    if not user:
        return {"ok": True}

    # Invalidar tokens anteriores del usuario
    db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.user_id == user.id,
        models.PasswordResetToken.used == False,
    ).update({"used": True})
    db.commit()

    token = secrets.token_urlsafe(32)
    reset_token = models.PasswordResetToken(
        user_id=user.id,
        token=token,
        expires_at=datetime.utcnow() + timedelta(hours=1),
    )
    db.add(reset_token)
    db.commit()

    email_utils.send_password_reset(user.email, user.name, token)
    return {"ok": True}


@router.post("/reset-password", status_code=200)
@limiter.limit("5/minute")
def reset_password(request: Request, data: ResetPasswordRequest, db: Session = Depends(get_db)):
    reset_token = db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.token == data.token,
        models.PasswordResetToken.used == False,
    ).first()

    if not reset_token:
        raise HTTPException(status_code=400, detail="Token inválido o ya utilizado")
    if reset_token.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="El enlace expiró. Solicitá uno nuevo.")

    user = db.query(models.User).filter(models.User.id == reset_token.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    user.hashed_password = auth_utils.hash_password(data.new_password)
    reset_token.used = True
    db.commit()
    return {"ok": True}
