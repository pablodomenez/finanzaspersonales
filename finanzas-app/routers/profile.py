from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import json
from database import get_db
import models
import auth as auth_utils

router = APIRouter(prefix="/api/profile", tags=["profile"])


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    birth_date: Optional[str] = None
    country: Optional[str] = None
    currency: Optional[str] = None
    occupation: Optional[str] = None
    bio: Optional[str] = None
    avatar_emoji: Optional[str] = None


def _profile_dict(user: models.User, profile: models.UserProfile) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "phone": profile.phone if profile else "",
        "birth_date": profile.birth_date if profile else "",
        "country": profile.country if profile else "",
        "currency": profile.currency if profile else "ARS",
        "occupation": profile.occupation if profile else "",
        "bio": profile.bio if profile else "",
        "avatar_emoji": profile.avatar_emoji if profile else "👤",
    }


@router.get("")
def get_profile(
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == current_user.id).first()
    return _profile_dict(current_user, profile)


@router.put("")
def update_profile(
    data: ProfileUpdate,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    if data.name is not None:
        current_user.name = data.name.strip()

    profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = models.UserProfile(user_id=current_user.id)
        db.add(profile)

    for field in ("phone", "birth_date", "country", "currency", "occupation", "bio", "avatar_emoji"):
        value = getattr(data, field)
        if value is not None:
            setattr(profile, field, value)

    db.commit()
    db.refresh(current_user)
    db.refresh(profile)
    return _profile_dict(current_user, profile)


DEFAULT_NAV_ORDER = [
    "dashboard", "transactions", "budgets", "cards", "debts", "goals",
    "inversiones", "alquileres", "servicios", "promociones", "prestamos",
    "compartidos", "reports", "decisiones", "feedback",
]


class NavPreferencesUpdate(BaseModel):
    order: List[str]
    hidden: List[str]


@router.get("/nav-preferences")
def get_nav_preferences(
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == current_user.id).first()
    if not profile or not profile.nav_preferences:
        return {"order": DEFAULT_NAV_ORDER, "hidden": []}
    try:
        prefs = json.loads(profile.nav_preferences)
        # Ensure any new sections not in saved order are appended
        saved_order = prefs.get("order", DEFAULT_NAV_ORDER)
        for section in DEFAULT_NAV_ORDER:
            if section not in saved_order:
                saved_order.append(section)
        return {"order": saved_order, "hidden": prefs.get("hidden", [])}
    except (json.JSONDecodeError, KeyError):
        return {"order": DEFAULT_NAV_ORDER, "hidden": []}


@router.put("/nav-preferences")
def update_nav_preferences(
    data: NavPreferencesUpdate,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    # dashboard cannot be hidden
    hidden = [h for h in data.hidden if h != "dashboard"]
    # order must contain only valid section ids
    valid_ids = set(DEFAULT_NAV_ORDER)
    order = [s for s in data.order if s in valid_ids]
    # append any missing sections
    for section in DEFAULT_NAV_ORDER:
        if section not in order:
            order.append(section)

    profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = models.UserProfile(user_id=current_user.id)
        db.add(profile)

    profile.nav_preferences = json.dumps({"order": order, "hidden": hidden})
    db.commit()
    return {"order": order, "hidden": hidden}
