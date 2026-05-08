import secrets
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel, Field
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/api/compartidos", tags=["compartidos"])


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class GroupCreate(BaseModel):
    name: str = Field(min_length=1)
    description: Optional[str] = ""
    participants: List[str] = Field(min_length=2)


class VirtualGroupCreate(BaseModel):
    name: str = Field(min_length=1)
    description: Optional[str] = ""


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ExpenseCreate(BaseModel):
    participant_id: Optional[int] = None  # ignorado en grupos virtuales
    description: str = Field(min_length=1)
    amount: float = Field(gt=0)
    date: Optional[datetime] = None


class InviteCreate(BaseModel):
    email: str


# ── Access control helper ─────────────────────────────────────────────────────

def _assert_access(group_id: int, user_id: int, db: Session):
    """Retorna (group, role) si el usuario tiene acceso; lanza 403/404 si no."""
    g = db.query(models.SharedGroup).filter(models.SharedGroup.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    if g.user_id == user_id:
        return g, "owner"
    if g.is_virtual:
        m = db.query(models.SharedGroupMember).filter_by(
            group_id=group_id, user_id=user_id
        ).first()
        if m:
            return g, m.role
    raise HTTPException(status_code=403, detail="No tenés acceso a este grupo")


# ── Calc helpers ──────────────────────────────────────────────────────────────

def _calc_settlements(balances: list[dict]) -> list[dict]:
    creditors = sorted([b for b in balances if b["balance"] > 0.005], key=lambda x: -x["balance"])
    debtors   = sorted([b for b in balances if b["balance"] < -0.005], key=lambda x: x["balance"])

    settlements = []
    ci, di = 0, 0
    while ci < len(creditors) and di < len(debtors):
        creditor = creditors[ci]
        debtor   = debtors[di]
        amount   = min(creditor["balance"], -debtor["balance"])
        amount   = round(amount, 2)
        if amount > 0:
            settlements.append({
                "from": debtor["name"],
                "to":   creditor["name"],
                "amount": amount,
            })
        creditor["balance"] -= amount
        debtor["balance"]   += amount
        if creditor["balance"] < 0.005:
            ci += 1
        if debtor["balance"] > -0.005:
            di += 1

    return settlements


def _serialize_group(g: models.SharedGroup, include_join_token: bool = False) -> dict:
    d = {
        "id":          g.id,
        "name":        g.name,
        "description": g.description,
        "is_settled":  g.is_settled,
        "is_virtual":  g.is_virtual,
        "created_at":  g.created_at.isoformat(),
        "participant_count": len(g.participants),
        "total": round(sum(e.amount for e in g.expenses), 2),
    }
    if include_join_token:
        d["join_token"] = g.join_token
    return d


def _group_detail(g: models.SharedGroup, current_user_id: int = None) -> dict:
    participants = g.participants
    expenses     = sorted(g.expenses, key=lambda e: e.date)

    total = sum(e.amount for e in expenses)
    n     = len(participants)
    share = round(total / n, 2) if n > 0 else 0

    paid_by = {p.id: 0.0 for p in participants}
    for e in expenses:
        paid_by[e.participant_id] = paid_by.get(e.participant_id, 0) + e.amount

    name_by_id = {p.id: p.name for p in participants}

    balances = [
        {
            "participant_id": p.id,
            "name":    p.name,
            "paid":    round(paid_by.get(p.id, 0), 2),
            "share":   share,
            "balance": round(paid_by.get(p.id, 0) - share, 2),
        }
        for p in participants
    ]

    settlements = _calc_settlements([dict(b) for b in balances])

    # Participante propio del usuario actual (para grupos virtuales)
    my_participant_id = None
    if current_user_id and g.is_virtual:
        my_p = next((p for p in participants if p.user_id == current_user_id), None)
        if my_p:
            my_participant_id = my_p.id

    is_owner = (g.user_id == current_user_id)

    return {
        "group": {
            "id":          g.id,
            "name":        g.name,
            "description": g.description,
            "is_settled":  g.is_settled,
            "is_virtual":  g.is_virtual,
            "is_owner":    is_owner,
            "join_token":  g.join_token if (is_owner and g.is_virtual) else None,
            "created_at":  g.created_at.isoformat(),
            "total":       round(total, 2),
        },
        "my_participant_id": my_participant_id,
        "participants": [{"id": p.id, "name": p.name, "user_id": p.user_id} for p in participants],
        "expenses": [
            {
                "id":             e.id,
                "participant_id": e.participant_id,
                "participant_name": name_by_id.get(e.participant_id, "?"),
                "description":    e.description,
                "amount":         e.amount,
                "date":           e.date.isoformat(),
            }
            for e in expenses
        ],
        "balances":    balances,
        "settlements": settlements,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/invites")
def list_invites(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Invitaciones pendientes para el usuario actual."""
    invites = (
        db.query(models.SharedGroupInvite)
        .filter_by(invitee_id=current_user.id, status="pending")
        .all()
    )
    result = []
    for inv in invites:
        if inv.expires_at < datetime.utcnow():
            continue
        result.append({
            "token":       inv.token,
            "group_id":    inv.group_id,
            "group_name":  inv.group.name,
            "inviter_name": inv.inviter.name,
            "created_at":  inv.created_at.isoformat(),
        })
    return result


@router.post("/invites/{token}/accept")
def accept_invite(
    token: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    inv = db.query(models.SharedGroupInvite).filter_by(token=token, status="pending").first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitación no encontrada o ya procesada")
    if inv.invitee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Esta invitación no es para vos")
    if inv.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="La invitación expiró")

    # Evitar duplicado
    existing = db.query(models.SharedGroupMember).filter_by(
        group_id=inv.group_id, user_id=current_user.id
    ).first()
    if not existing:
        db.add(models.SharedGroupMember(
            group_id=inv.group_id,
            user_id=current_user.id,
            role="member",
        ))
        db.add(models.SharedParticipant(
            group_id=inv.group_id,
            name=current_user.name,
            user_id=current_user.id,
        ))

    inv.status = "accepted"
    db.commit()
    return {"ok": True, "group_id": inv.group_id}


@router.post("/invites/{token}/decline")
def decline_invite(
    token: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    inv = db.query(models.SharedGroupInvite).filter_by(token=token, status="pending").first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitación no encontrada o ya procesada")
    if inv.invitee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Esta invitación no es para vos")
    inv.status = "declined"
    db.commit()
    return {"ok": True}


@router.get("")
def list_groups(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    member_group_ids = (
        db.query(models.SharedGroupMember.group_id)
        .filter(models.SharedGroupMember.user_id == current_user.id)
    )
    groups = (
        db.query(models.SharedGroup)
        .filter(
            or_(
                models.SharedGroup.user_id == current_user.id,
                models.SharedGroup.id.in_(member_group_ids),
            )
        )
        .order_by(models.SharedGroup.is_settled, models.SharedGroup.created_at.desc())
        .all()
    )
    return [_serialize_group(g) for g in groups]


@router.post("", status_code=201)
def create_group(
    data: GroupCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    names = [n.strip() for n in data.participants if n.strip()]
    if len(names) < 2:
        raise HTTPException(status_code=422, detail="Se necesitan al menos 2 participantes")

    g = models.SharedGroup(
        user_id=current_user.id,
        name=data.name.strip(),
        description=(data.description or "").strip(),
        is_virtual=False,
    )
    db.add(g)
    db.flush()

    for name in names:
        db.add(models.SharedParticipant(group_id=g.id, name=name))

    db.commit()
    db.refresh(g)
    return _serialize_group(g)


@router.post("/virtual", status_code=201)
def create_virtual_group(
    data: VirtualGroupCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    join_token = secrets.token_urlsafe(20)
    g = models.SharedGroup(
        user_id=current_user.id,
        name=data.name.strip(),
        description=(data.description or "").strip(),
        is_virtual=True,
        join_token=join_token,
    )
    db.add(g)
    db.flush()

    # El creador es el primer miembro y participante
    db.add(models.SharedGroupMember(group_id=g.id, user_id=current_user.id, role="owner"))
    db.add(models.SharedParticipant(group_id=g.id, name=current_user.name, user_id=current_user.id))

    db.commit()
    db.refresh(g)
    return _serialize_group(g, include_join_token=True)


@router.post("/join/{token}")
def join_group(
    token: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    g = db.query(models.SharedGroup).filter_by(join_token=token, is_virtual=True).first()
    if not g:
        raise HTTPException(status_code=404, detail="Enlace no válido o expirado")

    existing = db.query(models.SharedGroupMember).filter_by(
        group_id=g.id, user_id=current_user.id
    ).first()
    if existing:
        return {"ok": True, "group_id": g.id, "already_member": True}

    db.add(models.SharedGroupMember(group_id=g.id, user_id=current_user.id, role="member"))
    db.add(models.SharedParticipant(group_id=g.id, name=current_user.name, user_id=current_user.id))
    db.commit()
    return {"ok": True, "group_id": g.id, "already_member": False}


@router.post("/{group_id}/invite", status_code=201)
def invite_user(
    group_id: int,
    data: InviteCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    from email_utils import send_group_invite

    g, role = _assert_access(group_id, current_user.id, db)
    if not g.is_virtual:
        raise HTTPException(status_code=400, detail="Solo se puede invitar en grupos colaborativos")
    if role != "owner":
        raise HTTPException(status_code=403, detail="Solo el dueño puede invitar participantes")

    invitee = db.query(models.User).filter_by(email=data.email.strip().lower()).first()
    if not invitee:
        raise HTTPException(status_code=404, detail="No existe un usuario con ese email")
    if invitee.id == current_user.id:
        raise HTTPException(status_code=400, detail="No podés invitarte a vos mismo")

    # Verificar que no sea ya miembro
    already = db.query(models.SharedGroupMember).filter_by(
        group_id=group_id, user_id=invitee.id
    ).first()
    if already:
        raise HTTPException(status_code=409, detail="El usuario ya es miembro del grupo")

    # Verificar que no haya invitación pendiente
    pending = db.query(models.SharedGroupInvite).filter_by(
        group_id=group_id, invitee_id=invitee.id, status="pending"
    ).first()
    if pending and pending.expires_at > datetime.utcnow():
        raise HTTPException(status_code=409, detail="Ya existe una invitación pendiente para este usuario")

    token = secrets.token_urlsafe(32)
    inv = models.SharedGroupInvite(
        group_id=group_id,
        inviter_id=current_user.id,
        invitee_id=invitee.id,
        token=token,
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db.add(inv)
    db.commit()

    send_group_invite(
        to=invitee.email,
        invitee_name=invitee.name,
        inviter_name=current_user.name,
        group_name=g.name,
        token=token,
    )

    return {"ok": True, "invitee_name": invitee.name}


@router.get("/{group_id}/members")
def list_members(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    g, role = _assert_access(group_id, current_user.id, db)
    members = db.query(models.SharedGroupMember).filter_by(group_id=group_id).all()
    return [
        {"user_id": m.user_id, "name": m.user.name, "role": m.role, "joined_at": m.joined_at.isoformat()}
        for m in members
    ]


@router.get("/{group_id}")
def get_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    g, _ = _assert_access(group_id, current_user.id, db)
    return _group_detail(g, current_user_id=current_user.id)


@router.put("/{group_id}")
def update_group(
    group_id: int,
    data: GroupUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    g, role = _assert_access(group_id, current_user.id, db)
    if role != "owner":
        raise HTTPException(status_code=403, detail="Solo el dueño puede editar el grupo")
    if data.name is not None:
        g.name = data.name.strip()
    if data.description is not None:
        g.description = data.description.strip()
    db.commit()
    db.refresh(g)
    return _serialize_group(g)


@router.patch("/{group_id}/settle")
def toggle_settle(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    g, role = _assert_access(group_id, current_user.id, db)
    if role != "owner":
        raise HTTPException(status_code=403, detail="Solo el dueño puede saldar el grupo")
    g.is_settled = not g.is_settled
    db.commit()
    db.refresh(g)
    return _serialize_group(g)


@router.delete("/{group_id}", status_code=204)
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    g, role = _assert_access(group_id, current_user.id, db)
    if role != "owner":
        raise HTTPException(status_code=403, detail="Solo el dueño puede eliminar el grupo")
    db.delete(g)
    db.commit()


@router.post("/{group_id}/expenses", status_code=201)
def add_expense(
    group_id: int,
    data: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    g, _ = _assert_access(group_id, current_user.id, db)

    if g.is_virtual:
        participant = db.query(models.SharedParticipant).filter_by(
            group_id=group_id, user_id=current_user.id
        ).first()
        if not participant:
            raise HTTPException(status_code=403, detail="No tenés un slot de participante en este grupo")
        participant_id = participant.id
    else:
        participant = db.query(models.SharedParticipant).filter_by(
            id=data.participant_id, group_id=group_id
        ).first()
        if not participant:
            raise HTTPException(status_code=404, detail="Participante no encontrado")
        participant_id = data.participant_id

    e = models.SharedExpense(
        group_id=group_id,
        participant_id=participant_id,
        description=data.description.strip(),
        amount=data.amount,
        date=data.date or datetime.utcnow(),
    )
    db.add(e)
    db.commit()
    db.refresh(g)
    return _group_detail(g, current_user_id=current_user.id)


@router.delete("/expenses/{expense_id}", status_code=204)
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    e = db.query(models.SharedExpense).filter_by(id=expense_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")

    g, role = _assert_access(e.group_id, current_user.id, db)

    # Owner siempre puede borrar; miembro solo puede borrar su propio gasto
    if role != "owner":
        my_p = db.query(models.SharedParticipant).filter_by(
            group_id=e.group_id, user_id=current_user.id
        ).first()
        if not my_p or my_p.id != e.participant_id:
            raise HTTPException(status_code=403, detail="Solo podés eliminar tus propios gastos")

    db.delete(e)
    db.commit()
