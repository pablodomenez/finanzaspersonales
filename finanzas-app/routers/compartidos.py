from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/api/compartidos", tags=["compartidos"])


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class GroupCreate(BaseModel):
    name: str = Field(min_length=1)
    description: Optional[str] = ""
    participants: List[str] = Field(min_length=2)  # al menos 2 nombres


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ExpenseCreate(BaseModel):
    participant_id: int
    description: str = Field(min_length=1)
    amount: float = Field(gt=0)
    date: Optional[datetime] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _calc_settlements(balances: list[dict]) -> list[dict]:
    """Calcula las transferencias mínimas para saldar el grupo."""
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


def _serialize_group(g: models.SharedGroup) -> dict:
    return {
        "id":          g.id,
        "name":        g.name,
        "description": g.description,
        "is_settled":  g.is_settled,
        "created_at":  g.created_at.isoformat(),
        "participant_count": len(g.participants),
        "total": round(sum(e.amount for e in g.expenses), 2),
    }


def _group_detail(g: models.SharedGroup) -> dict:
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

    return {
        "group": {
            "id":          g.id,
            "name":        g.name,
            "description": g.description,
            "is_settled":  g.is_settled,
            "created_at":  g.created_at.isoformat(),
            "total":       round(total, 2),
        },
        "participants": [{"id": p.id, "name": p.name} for p in participants],
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

@router.get("")
def list_groups(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    groups = (
        db.query(models.SharedGroup)
        .filter(models.SharedGroup.user_id == current_user.id)
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
    )
    db.add(g)
    db.flush()

    for name in names:
        db.add(models.SharedParticipant(group_id=g.id, name=name))

    db.commit()
    db.refresh(g)
    return _serialize_group(g)


@router.get("/{group_id}")
def get_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    g = db.query(models.SharedGroup).filter(
        models.SharedGroup.id == group_id,
        models.SharedGroup.user_id == current_user.id,
    ).first()
    if not g:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    return _group_detail(g)


@router.put("/{group_id}")
def update_group(
    group_id: int,
    data: GroupUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    g = db.query(models.SharedGroup).filter(
        models.SharedGroup.id == group_id,
        models.SharedGroup.user_id == current_user.id,
    ).first()
    if not g:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
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
    g = db.query(models.SharedGroup).filter(
        models.SharedGroup.id == group_id,
        models.SharedGroup.user_id == current_user.id,
    ).first()
    if not g:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
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
    g = db.query(models.SharedGroup).filter(
        models.SharedGroup.id == group_id,
        models.SharedGroup.user_id == current_user.id,
    ).first()
    if not g:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    db.delete(g)
    db.commit()


@router.post("/{group_id}/expenses", status_code=201)
def add_expense(
    group_id: int,
    data: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    g = db.query(models.SharedGroup).filter(
        models.SharedGroup.id == group_id,
        models.SharedGroup.user_id == current_user.id,
    ).first()
    if not g:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")

    participant = db.query(models.SharedParticipant).filter(
        models.SharedParticipant.id == data.participant_id,
        models.SharedParticipant.group_id == group_id,
    ).first()
    if not participant:
        raise HTTPException(status_code=404, detail="Participante no encontrado")

    e = models.SharedExpense(
        group_id=group_id,
        participant_id=data.participant_id,
        description=data.description.strip(),
        amount=data.amount,
        date=data.date or datetime.utcnow(),
    )
    db.add(e)
    db.commit()
    db.refresh(g)
    return _group_detail(g)


@router.delete("/expenses/{expense_id}", status_code=204)
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    e = db.query(models.SharedExpense).join(models.SharedGroup).filter(
        models.SharedExpense.id == expense_id,
        models.SharedGroup.user_id == current_user.id,
    ).first()
    if not e:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    db.delete(e)
    db.commit()
