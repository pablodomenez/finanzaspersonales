"""Tests de autenticación."""
import pytest


def test_register_success(client):
    resp = client.post("/api/auth/register", json={
        "name": "Juan Pérez",
        "email": "juan@test.com",
        "password": "password123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user_name"] == "Juan Pérez"
    assert data["terms_accepted"] is False


def test_register_duplicate_email(client):
    payload = {"name": "A", "email": "dup@test.com", "password": "password123"}
    client.post("/api/auth/register", json=payload)
    resp = client.post("/api/auth/register", json=payload)
    assert resp.status_code == 400
    assert "registrado" in resp.json()["detail"].lower()


def test_register_weak_password(client):
    resp = client.post("/api/auth/register", json={
        "name": "B", "email": "b@test.com", "password": "short",
    })
    assert resp.status_code == 422


def test_login_success(client):
    client.post("/api/auth/register", json={
        "name": "Login Test", "email": "login@test.com", "password": "password123",
    })
    resp = client.post("/api/auth/login", json={
        "email": "login@test.com", "password": "password123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_login_wrong_password(client):
    client.post("/api/auth/register", json={
        "name": "C", "email": "c@test.com", "password": "correct123",
    })
    resp = client.post("/api/auth/login", json={
        "email": "c@test.com", "password": "wrongpassword",
    })
    assert resp.status_code == 401


def test_me_authenticated(client, auth_headers):
    resp = client.get("/api/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "email" in data
    assert "name" in data


def test_me_unauthenticated(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 403


def test_refresh_token(client, db):
    import models
    import uuid
    from auth import hash_password, create_refresh_token

    email = f"refresh_{uuid.uuid4().hex[:8]}@test.com"
    user = models.User(name="Refresh Test", email=email, hashed_password=hash_password("password123"))
    db.add(user)
    db.commit()
    db.refresh(user)

    refresh_token = create_refresh_token(user.id)
    resp = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_refresh_invalid_token(client):
    resp = client.post("/api/auth/refresh", json={"refresh_token": "invalid.token.here"})
    assert resp.status_code == 401
