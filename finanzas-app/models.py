from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from database import Base
import enum


class TransactionType(str, enum.Enum):
    income = "income"
    expense = "expense"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    google_id = Column(String, unique=True, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    terms_accepted_at = Column(DateTime, nullable=True)

    transactions = relationship("Transaction", back_populates="user", cascade="all, delete")
    budgets = relationship("Budget", back_populates="user", cascade="all, delete")
    goals = relationship("Goal", back_populates="user", cascade="all, delete")
    debts = relationship("Debt", back_populates="user", cascade="all, delete")
    credit_cards = relationship("CreditCard", back_populates="user", cascade="all, delete")
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete")
    servicios = relationship("Servicio", back_populates="user", cascade="all, delete")
    notificaciones = relationship("Notificacion", back_populates="user", cascade="all, delete")
    pagos_servicios = relationship("PagoServicio", back_populates="user", cascade="all, delete")
    inversor_perfil = relationship("InversorPerfil", back_populates="user", uselist=False, cascade="all, delete")
    inversiones = relationship("Inversion", back_populates="user", cascade="all, delete")
    historico_inversiones = relationship("HistoricoInversion", back_populates="user", cascade="all, delete")
    dividendos_inversiones = relationship("DividendoInversion", back_populates="user", cascade="all, delete")
    promociones = relationship("Promocion", back_populates="user", cascade="all, delete")
    notificaciones_promo = relationship("NotificacionPromo", back_populates="user", cascade="all, delete")
    shared_groups = relationship("SharedGroup", back_populates="user", cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    icon = Column(String, default="💰")
    type = Column(String, default="expense")  # "expense" | "income" | "both"

    transactions = relationship("Transaction", back_populates="category")
    budgets = relationship("Budget", back_populates="category")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    type = Column(Enum(TransactionType), nullable=False)
    description = Column(String, default="")
    date = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    payment_method = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="transactions")
    category = relationship("Category", back_populates="transactions")


class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False, index=True)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    limit_amount = Column(Float, nullable=False)

    user = relationship("User", back_populates="budgets")
    category = relationship("Category", back_populates="budgets")


class DebtType(str, enum.Enum):
    owe = "owe"        # yo le debo a alguien
    owed = "owed"      # alguien me debe a mí


class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    icon = Column(String, default="🎯")
    target_amount = Column(Float, nullable=False)
    current_amount = Column(Float, default=0.0)
    deadline = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="goals")


class Debt(Base):
    __tablename__ = "debts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    person_name = Column(String, nullable=False)
    description = Column(String, default="")
    amount = Column(Float, nullable=False)
    type = Column(Enum(DebtType), nullable=False)
    due_date = Column(DateTime, nullable=True)
    paid = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="debts")


class CreditCard(Base):
    __tablename__ = "credit_cards"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    bank = Column(String, default="")
    last_four = Column(String, default="")
    credit_limit = Column(Float, nullable=True)
    closing_day = Column(Integer, nullable=True)
    due_day = Column(Integer, nullable=True)
    color = Column(String, default="#3b82f6")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="credit_cards")
    expenses = relationship("CardExpense", back_populates="card", cascade="all, delete-orphan")


class CardExpense(Base):
    __tablename__ = "card_expenses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    card_id = Column(Integer, ForeignKey("credit_cards.id"), nullable=False, index=True)
    description = Column(String, nullable=False)
    total_amount = Column(Float, nullable=False)
    installments = Column(Integer, default=1)
    first_payment_month = Column(Integer, nullable=False)
    first_payment_year = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    card = relationship("CreditCard", back_populates="expenses")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    phone = Column(String, default="")
    birth_date = Column(String, default="")        # ISO date string YYYY-MM-DD
    country = Column(String, default="")
    currency = Column(String, default="ARS")
    occupation = Column(String, default="")
    bio = Column(String, default="")
    avatar_emoji = Column(String, default="👤")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="profile")


class Servicio(Base):
    __tablename__ = "servicios"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    nombre = Column(String, nullable=False)
    categoria = Column(String, nullable=False)
    monto = Column(Float, nullable=False)
    dia_vencimiento = Column(Integer, nullable=False)   # 1-28
    frecuencia = Column(String, default="mensual")      # mensual, bimestral, trimestral, semestral, anual
    notas = Column(String, default="")
    numero_cuenta = Column(String, default="")
    link_pago = Column(String, default="")
    monto_variable = Column(Boolean, default=False)
    activo = Column(Boolean, default=True)
    proximo_vencimiento = Column(String, nullable=True)  # YYYY-MM-DD
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="servicios")
    notificaciones = relationship("Notificacion", back_populates="servicio", cascade="all, delete-orphan")
    pagos = relationship("PagoServicio", back_populates="servicio", cascade="all, delete-orphan")


class Notificacion(Base):
    __tablename__ = "notificaciones"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    servicio_id = Column(Integer, ForeignKey("servicios.id"), nullable=False)
    mensaje = Column(String, nullable=False)
    leida = Column(Boolean, default=False)
    vencimiento_ref = Column(String, nullable=False)    # YYYY-MM-DD de qué vencimiento es
    created_at = Column(DateTime, default=datetime.utcnow)

    servicio = relationship("Servicio", back_populates="notificaciones")
    user = relationship("User", back_populates="notificaciones")


class PagoServicio(Base):
    __tablename__ = "pagos_servicios"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    servicio_id = Column(Integer, ForeignKey("servicios.id"), nullable=False, index=True)
    monto_pagado = Column(Float, nullable=False)
    fecha_pago = Column(String, nullable=False)   # YYYY-MM-DD
    periodo = Column(String, nullable=False)      # YYYY-MM
    notas = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    servicio = relationship("Servicio", back_populates="pagos")
    user = relationship("User", back_populates="pagos_servicios")


class InversorPerfil(Base):
    __tablename__ = "inversor_perfiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    perfil = Column(String, nullable=False)    # conservador, moderado, agresivo
    puntaje = Column(Integer, nullable=False)
    respuestas = Column(String, default="")   # JSON string de respuestas
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="inversor_perfil")


class Inversion(Base):
    __tablename__ = "inversiones"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    tipo = Column(String, nullable=False)          # plazo_fijo, fci, acciones, cedears, bonos, cripto, dolar, inmueble, otros
    nombre = Column(String, nullable=False)
    moneda = Column(String, default="ARS")         # ARS, USD
    monto_invertido = Column(Float, nullable=False)
    valor_actual = Column(Float, nullable=False)
    fecha_inicio = Column(String, nullable=False)  # YYYY-MM-DD
    fecha_vencimiento = Column(String, nullable=True)  # YYYY-MM-DD (para plazo fijo / bonos)
    tasa_anual = Column(Float, nullable=True)      # TNA para plazo fijo
    estado = Column(String, default="activo")      # activo, cerrado, vencido
    notas = Column(String, default="")
    notas_tesis = Column(String, default="")       # tesis / razonamiento de la inversión
    ticker = Column(String, default="")            # ticker Yahoo Finance o ID CoinGecko
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="inversiones")
    historico = relationship("HistoricoInversion", back_populates="inversion", cascade="all, delete-orphan")
    dividendos = relationship("DividendoInversion", back_populates="inversion", cascade="all, delete-orphan")


class HistoricoInversion(Base):
    __tablename__ = "historico_inversiones"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    inversion_id = Column(Integer, ForeignKey("inversiones.id"), nullable=False, index=True)
    valor = Column(Float, nullable=False)
    fecha = Column(String, nullable=False)    # YYYY-MM-DD
    created_at = Column(DateTime, default=datetime.utcnow)

    inversion = relationship("Inversion", back_populates="historico")
    user = relationship("User", back_populates="historico_inversiones")


class DividendoInversion(Base):
    __tablename__ = "dividendos_inversiones"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    inversion_id = Column(Integer, ForeignKey("inversiones.id"), nullable=False, index=True)
    monto = Column(Float, nullable=False)
    moneda = Column(String, default="ARS")
    fecha = Column(String, nullable=False)    # YYYY-MM-DD
    tipo = Column(String, default="dividendo")  # dividendo, cupon, renta, otro
    notas = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    inversion = relationship("Inversion", back_populates="dividendos")
    user = relationship("User", back_populates="dividendos_inversiones")


class Promocion(Base):
    __tablename__ = "promociones"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    servicio_nombre = Column(String, nullable=False)
    categoria = Column(String, default="")
    descripcion_promo = Column(String, default="")
    monto_con_promo = Column(Float, nullable=False)
    monto_sin_promo = Column(Float, nullable=True)
    numero_cliente = Column(String, default="")
    telefono_contacto = Column(String, default="")
    link_contacto = Column(String, default="")
    fecha_inicio_promo = Column(String, nullable=True)   # YYYY-MM-DD
    fecha_fin_promo = Column(String, nullable=False)     # YYYY-MM-DD
    activa = Column(Boolean, default=True)
    notas = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="promociones")
    notificaciones_promo = relationship("NotificacionPromo", back_populates="promocion", cascade="all, delete-orphan")


class NotificacionPromo(Base):
    __tablename__ = "notificaciones_promo"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    promocion_id = Column(Integer, ForeignKey("promociones.id"), nullable=False)
    mensaje = Column(String, nullable=False)
    leida = Column(Boolean, default=False)
    vencimiento_ref = Column(String, nullable=False)   # YYYY-MM-DD
    created_at = Column(DateTime, default=datetime.utcnow)

    promocion = relationship("Promocion", back_populates="notificaciones_promo")
    user = relationship("User", back_populates="notificaciones_promo")


class SharedGroup(Base):
    __tablename__ = "shared_groups"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name        = Column(String, nullable=False)
    description = Column(String, default="")
    is_settled  = Column(Boolean, default=False)
    created_at  = Column(DateTime, default=datetime.utcnow)

    user         = relationship("User", back_populates="shared_groups")
    participants = relationship("SharedParticipant", back_populates="group", cascade="all, delete-orphan")
    expenses     = relationship("SharedExpense", back_populates="group", cascade="all, delete-orphan")


class SharedParticipant(Base):
    __tablename__ = "shared_participants"

    id       = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("shared_groups.id"), nullable=False, index=True)
    name     = Column(String, nullable=False)

    group    = relationship("SharedGroup", back_populates="participants")
    expenses = relationship("SharedExpense", back_populates="participant")


class SharedExpense(Base):
    __tablename__ = "shared_expenses"

    id             = Column(Integer, primary_key=True, index=True)
    group_id       = Column(Integer, ForeignKey("shared_groups.id"), nullable=False, index=True)
    participant_id = Column(Integer, ForeignKey("shared_participants.id"), nullable=False)
    description    = Column(String, nullable=False)
    amount         = Column(Float, nullable=False)
    date           = Column(DateTime, default=datetime.utcnow)
    created_at     = Column(DateTime, default=datetime.utcnow)

    group       = relationship("SharedGroup", back_populates="expenses")
    participant = relationship("SharedParticipant", back_populates="expenses")
