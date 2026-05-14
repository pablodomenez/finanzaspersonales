"""Tests de transacciones."""
import pytest
from datetime import datetime


def _create_tx(client, headers, **kwargs):
    defaults = {
        "description": "Test tx",
        "amount": 1000.0,
        "type": "expense",
        "category_id": 5,
        "date": datetime.utcnow().isoformat(),
    }
    defaults.update(kwargs)
    return client.post("/api/transactions", json=defaults, headers=headers)


def test_create_transaction(client, auth_headers):
    resp = _create_tx(client, auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["amount"] == 1000.0
    assert data["type"] == "expense"


def test_list_transactions(client, auth_headers):
    _create_tx(client, auth_headers, description="Comida", amount=500)
    resp = client.get("/api/transactions", headers=auth_headers)
    assert resp.status_code == 200
    items = resp.json()
    assert isinstance(items, (list, dict))


def test_create_income(client, auth_headers):
    resp = _create_tx(client, auth_headers, type="income", category_id=1, amount=50000.0)
    assert resp.status_code == 201
    assert resp.json()["type"] == "income"


def test_delete_transaction(client, auth_headers):
    create = _create_tx(client, auth_headers, amount=999)
    tx_id  = create.json()["id"]
    resp   = client.delete(f"/api/transactions/{tx_id}", headers=auth_headers)
    assert resp.status_code == 204


def test_edit_transaction(client, auth_headers):
    create = _create_tx(client, auth_headers, amount=100)
    tx_id  = create.json()["id"]
    resp   = client.put(f"/api/transactions/{tx_id}", json={
        "description": "Editado", "amount": 200.0, "type": "expense",
        "category_id": 5, "date": datetime.utcnow().isoformat(),
    }, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["amount"] == 200.0


def test_invalid_amount(client, auth_headers):
    resp = _create_tx(client, auth_headers, amount=-100)
    assert resp.status_code == 422
