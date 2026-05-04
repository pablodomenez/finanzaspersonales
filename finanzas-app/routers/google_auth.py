import os
from urllib.parse import urlencode
import requests as http_req
from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from database import get_db
import models
from auth import create_access_token

router = APIRouter(prefix="/api/auth", tags=["google-auth"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")


@router.get("/google")
def google_login():
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}")


@router.get("/google/callback")
def google_callback(code: str = None, error: str = None, db: Session = Depends(get_db)):
    if error or not code:
        return RedirectResponse("/login.html?error=google_cancelado")

    token_resp = http_req.post("https://oauth2.googleapis.com/token", data={
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI,
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

    user = db.query(models.User).filter(models.User.google_id == google_id).first()
    if not user:
        user = db.query(models.User).filter(models.User.email == email).first()
        if user:
            user.google_id = google_id
        else:
            user = models.User(
                email=email,
                name=name,
                hashed_password="",
                google_id=google_id,
            )
            db.add(user)
    db.commit()
    db.refresh(user)

    jwt_token = create_access_token({"sub": str(user.id)})
    from urllib.parse import quote
    return RedirectResponse(f"/oauth-callback.html?token={jwt_token}&name={quote(user.name)}")
