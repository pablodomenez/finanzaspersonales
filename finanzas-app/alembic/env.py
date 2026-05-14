import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# Importar todos los modelos para que Alembic los detecte
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from database import Base, DATABASE_URL  # noqa: F401
import models  # noqa: F401 — registra todas las tablas

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Setear la URL desde el env (sobreescribe alembic.ini en prod)
db_url = os.getenv("DATABASE_URL", "sqlite:///./finanzas.db")
# Normalizar postgres:// → postgresql://
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)
config.set_main_option("sqlalchemy.url", db_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,  # necesario para SQLite
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,  # necesario para SQLite
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
