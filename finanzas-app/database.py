import os
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
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

if is_postgres:
    # Quitar driver explícito en la URL (+pg8000, +psycopg2) y usar psycopg2 por defecto
    for drv in ("+pg8000", "+psycopg2"):
        DATABASE_URL = DATABASE_URL.replace(f"postgresql{drv}://", "postgresql://", 1)
    # Eliminar channel_binding que psycopg2 no soporta
    parsed = urlparse(DATABASE_URL)
    params = parse_qs(parsed.query, keep_blank_values=True)
    params.pop("channel_binding", None)
    new_query = urlencode({k: v[0] for k, v in params.items()})
    DATABASE_URL = urlunparse(parsed._replace(query=new_query))

if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    connect_args = {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
