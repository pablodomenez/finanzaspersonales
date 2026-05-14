"""Tests del dashboard."""
import pytest
from datetime import datetime


def test_dashboard_summary_empty(client, auth_headers):
    now  = datetime.utcnow()
    resp = client.get(f"/api/dashboard/summary?month={now.month}&year={now.year}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "total_income" in data
    assert "total_expense" in data
    assert "balance" in data
    assert "monthly_trend" in data
    assert "by_category" in data


def test_dashboard_networth(client, auth_headers):
    resp = client.get("/api/dashboard/networth", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "activos" in data
    assert "pasivos" in data
    assert "patrimonio_neto" in data
    assert "detalle" in data


def test_dashboard_proyecciones(client, auth_headers):
    resp = client.get("/api/dashboard/proyecciones?months=3", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "proyecciones" in data
    assert len(data["proyecciones"]) == 3
    assert "base" in data


def test_dashboard_unauthenticated(client):
    resp = client.get("/api/dashboard/summary")
    assert resp.status_code == 403
