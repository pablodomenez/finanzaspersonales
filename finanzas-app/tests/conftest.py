"""Fixtures compartidas para todos los tests."""
import os
import pytest

# Configurar variables de entorno ANTES de cualquier import de la app
os.environ["SECRET_KEY"] = "test-secret-key-32-characters-long!!"
os.environ["DATABASE_URL"] = "sqlite:///./test_finanzas.db"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "30"
os.environ["VERCEL"] = "1"  # Deshabilita background tasks durante los tests

from sqlalchemy import create_engine          # noqa: E402
from sqlalchemy.orm import sessionmaker       # noqa: E402
from fastapi.testclient import TestClient     # noqa: E402

import database as _db                        # noqa: E402

# Reemplazar el engine de la app con uno de test (archivo temporal)
_test_engine = create_engine(
    "sqlite:///./test_finanzas.db",
    connect_args={"check_same_thread": False},
)
_db.engine = _test_engine
_db.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_test_engine)

from database import Base, get_db             # noqa: E402
from main import app                          # noqa: E402

# Crear todas las tablas en la BD de test
Base.metadata.create_all(bind=_test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=_test_engine)
    yield
    Base.metadata.drop_all(bind=_test_engine)
    _test_engine.dispose()
    try:
        os.remove("test_finanzas.db")
    except (FileNotFoundError, PermissionError):
        pass


@pytest.fixture
def db():
    session = _db.SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(db):
    """Crea un usuario de test directamente en la BD (evita rate limits) y devuelve headers."""
    import models
    from auth import hash_password, create_access_token

    # Usar email único para evitar conflictos entre tests
    import uuid
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    user  = models.User(name="Test User", email=email, hashed_password=hash_password("testpass123"))
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return {"Authorization": f"Bearer {token}"}
