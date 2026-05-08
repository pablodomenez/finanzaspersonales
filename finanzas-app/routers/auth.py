from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field
from database import get_db
import models
import auth as auth_utils

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
    token_type: str = "bearer"
    user_name: str
    terms_accepted: bool


@router.post("/register", response_model=TokenResponse)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
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
    token = auth_utils.create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, user_name=user.name, terms_accepted=False)


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user or not auth_utils.verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    token = auth_utils.create_access_token({"sub": str(user.id)})
    return TokenResponse(
        access_token=token,
        user_name=user.name,
        terms_accepted=(user.terms_accepted_at is not None),
    )


@router.post("/accept-terms", status_code=200)
def accept_terms(
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    current_user.terms_accepted_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.get("/me")
def me(current_user: models.User = Depends(auth_utils.get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "terms_accepted": current_user.terms_accepted_at is not None,
    }
