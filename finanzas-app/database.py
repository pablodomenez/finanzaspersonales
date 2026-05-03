import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "").lstrip('﻿').strip()
if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./finanzas.db"

# Normalizar prefijo postgres:// → postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

is_postgres = DATABASE_URL.startswith("postgresql")

# En Vercel usar psycopg2-binary (mejor soporte de SCRAM auth con Supavisor)
# Localmente se usa pg8000 si está especificado, o el driver por defecto
if os.getenv("VERCEL") and is_postgres:
    # Quitar cualquier driver previo y usar psycopg2
    for drv in ("+pg8000", "+psycopg2"):
        DATABASE_URL = DATABASE_URL.replace(f"postgresql{drv}://", "postgresql://", 1)

if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
elif os.getenv("VERCEL") and is_postgres:
    connect_args = {"sslmode": "require"}
elif "+pg8000" in DATABASE_URL:
    import ssl
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    connect_args = {"ssl_context": ssl_context}
else:
    connect_args = {"sslmode": "require"}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
