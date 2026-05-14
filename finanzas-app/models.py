from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Boolean, Text
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
    shared_group_memberships = relationship("SharedGroupMember", back_populates="user", cascade="all, delete-orphan")
    feedbacks = relationship("Feedback", back_populates="user", cascade="all, delete")
    alquileres = relationship("Alquiler", back_populates="user", cascade="all, delete")
    notificaciones_alquileres = relationship("NotificacionAlquiler", back_populates="user", cascade="all, delete")
    prestamos = relationship("Prestamo", back_populates="user", cascade="all, delete-orphan")


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
    payments = relationship("CardPayment", back_populates="card", cascade="all, delete-orphan")


class CardExpense(Base):
    __tablename__ = "card_expenses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    card_id = Column(Integer, ForeignKey("credit_cards.id"), nullable=False, index=True)
    description = Column(String, nullable=False)
    total_amount = Column(Float, nullable=False)
    expense_type = Column(String, default="cuota")  # "cuota" | "debito_automatico"
    installments = Column(Integer, default=1)
    first_payment_month = Column(Integer, nullable=False)
    first_payment_year = Column(Integer, nullable=False)
    end_month = Column(Integer, nullable=True)
    end_year = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    card = relationship("CreditCard", back_populates="expenses")


class CardPayment(Base):
    __tablename__ = "card_payments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    card_id = Column(Integer, ForeignKey("credit_cards.id"), nullable=False, index=True)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    total_due = Column(Float, nullable=False)
    amount_paid = Column(Float, nullable=False)
    pending_balance = Column(Float, nullable=False, default=0.0)
    status = Column(String, default="pending")  # "paid" | "partial"
    paid_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(String, default="")

    card = relationship("CreditCard", back_populates="payments")


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
    forma_pago = Column(String, default="")
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


class Feedback(Base):
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    rating = Column(Integer, nullable=False)          # 1–5
    tema = Column(String, nullable=True)               # "general" | nombre de sección
    mensaje = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="feedbacks")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String, unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class SharedGroup(Base):
    __tablename__ = "shared_groups"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name        = Column(String, nullable=False)
    description = Column(String, default="")
    is_settled  = Column(Boolean, default=False)
    is_virtual  = Column(Boolean, default=False, nullable=False)
    join_token  = Column(String, unique=True, nullable=True, index=True)
    created_at  = Column(DateTime, default=datetime.utcnow)

    user         = relationship("User", back_populates="shared_groups")
    participants = relationship("SharedParticipant", back_populates="group", cascade="all, delete-orphan")
    expenses     = relationship("SharedExpense", back_populates="group", cascade="all, delete-orphan")
    members      = relationship("SharedGroupMember", back_populates="group", cascade="all, delete-orphan")
    invites      = relationship("SharedGroupInvite", back_populates="group", cascade="all, delete-orphan")


class SharedParticipant(Base):
    __tablename__ = "shared_participants"

    id       = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("shared_groups.id"), nullable=False, index=True)
    name     = Column(String, nullable=False)
    user_id  = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    group    = relationship("SharedGroup", back_populates="participants")
    expenses = relationship("SharedExpense", back_populates="participant")


class SharedGroupMember(Base):
    __tablename__ = "shared_group_members"

    id        = Column(Integer, primary_key=True, index=True)
    group_id  = Column(Integer, ForeignKey("shared_groups.id"), nullable=False, index=True)
    user_id   = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role      = Column(String, default="member")  # "owner" | "member"
    joined_at = Column(DateTime, default=datetime.utcnow)

    group = relationship("SharedGroup", back_populates="members")
    user  = relationship("User", back_populates="shared_group_memberships")


class SharedGroupInvite(Base):
    __tablename__ = "shared_group_invites"

    id          = Column(Integer, primary_key=True, index=True)
    group_id    = Column(Integer, ForeignKey("shared_groups.id"), nullable=False, index=True)
    inviter_id  = Column(Integer, ForeignKey("users.id"), nullable=False)
    invitee_id  = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token       = Column(String, unique=True, nullable=False, index=True)
    status      = Column(String, default="pending")  # "pending" | "accepted" | "declined"
    expires_at  = Column(DateTime, nullable=False)
    created_at  = Column(DateTime, default=datetime.utcnow)

    group   = relationship("SharedGroup", back_populates="invites")
    inviter = relationship("User", foreign_keys=[inviter_id])
    invitee = relationship("User", foreign_keys=[invitee_id])


class SharedExpense(Base):
    __tablename__ = "shared_expenses"

    id             = Column(Integer, primary_key=True, index=True)
    group_id       = Column(Integer, ForeignKey("shared_groups.id"), nullable=False, index=True)
    participant_id = Column(Integer, ForeignKey("shared_participants.id"), nullable=False)
    description    = Column(String, nullable=False)
    amount         = Column(Float, nullable=False)
    date           = Column(DateTime, default=datetime.utcnow)
    created_at     = Column(DateTime, default=datetime.utcnow)
    comprobante    = Column(Text, nullable=True)

    group       = relationship("SharedGroup", back_populates="expenses")
    participant = relationship("SharedParticipant", back_populates="expenses")


class Alquiler(Base):
    __tablename__ = "alquileres"

    id                       = Column(Integer, primary_key=True, index=True)
    user_id                  = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    nombre                   = Column(String, nullable=False)          # ej: "Dpto Palermo"
    direccion                = Column(String, default="")
    contraparte_nombre       = Column(String, default="")              # inquilino (propietario) o propietario (inquilino)
    rol                      = Column(String, default="inquilino")     # "inquilino" | "propietario"
    valor_actual             = Column(Float, nullable=False)
    moneda                   = Column(String, default="ARS")           # ARS | USD
    fecha_inicio             = Column(String, nullable=False)          # YYYY-MM-DD
    fecha_fin_contrato       = Column(String, nullable=True)           # YYYY-MM-DD (null = indeterminado)
    dia_pago                 = Column(Integer, default=1)              # día del mes (1-28)
    indice_actualizacion     = Column(String, default="ICL")          # ICL | IPC | CVS | fijo
    porcentaje_fijo          = Column(Float, nullable=True)            # solo si indice = fijo
    periodo_actualizacion_meses = Column(Integer, default=3)          # cada cuántos meses
    proxima_actualizacion    = Column(String, nullable=True)           # YYYY-MM-DD
    valor_inmueble           = Column(Float, nullable=True)            # para cálculo de ROI
    notas                    = Column(String, default="")
    activo                   = Column(Boolean, default=True)
    created_at               = Column(DateTime, default=datetime.utcnow)

    user            = relationship("User", back_populates="alquileres")
    pagos           = relationship("PagoAlquiler", back_populates="alquiler", cascade="all, delete-orphan")
    actualizaciones = relationship("ActualizacionAlquiler", back_populates="alquiler", cascade="all, delete-orphan")
    gastos          = relationship("GastoAlquiler", back_populates="alquiler", cascade="all, delete-orphan")
    notificaciones  = relationship("NotificacionAlquiler", back_populates="alquiler", cascade="all, delete-orphan")


class PagoAlquiler(Base):
    __tablename__ = "pagos_alquileres"

    id             = Column(Integer, primary_key=True, index=True)
    alquiler_id    = Column(Integer, ForeignKey("alquileres.id"), nullable=False, index=True)
    periodo        = Column(String, nullable=False)    # YYYY-MM
    monto_esperado = Column(Float, nullable=False)
    monto_pagado   = Column(Float, nullable=True)
    fecha_pago     = Column(String, nullable=True)     # YYYY-MM-DD
    estado         = Column(String, default="pendiente")  # pagado | pendiente | atrasado
    comprobante    = Column(Text, nullable=True)       # base64
    notas          = Column(String, default="")
    created_at     = Column(DateTime, default=datetime.utcnow)

    alquiler = relationship("Alquiler", back_populates="pagos")


class ActualizacionAlquiler(Base):
    __tablename__ = "actualizaciones_alquileres"

    id                  = Column(Integer, primary_key=True, index=True)
    alquiler_id         = Column(Integer, ForeignKey("alquileres.id"), nullable=False, index=True)
    fecha               = Column(String, nullable=False)    # YYYY-MM-DD
    valor_anterior      = Column(Float, nullable=False)
    valor_nuevo         = Column(Float, nullable=False)
    indice_usado        = Column(String, nullable=False)    # ICL | IPC | CVS | fijo
    porcentaje_aplicado = Column(Float, nullable=False)
    notas               = Column(String, default="")
    created_at          = Column(DateTime, default=datetime.utcnow)

    alquiler = relationship("Alquiler", back_populates="actualizaciones")


class GastoAlquiler(Base):
    __tablename__ = "gastos_alquileres"

    id          = Column(Integer, primary_key=True, index=True)
    alquiler_id = Column(Integer, ForeignKey("alquileres.id"), nullable=False, index=True)
    descripcion = Column(String, nullable=False)
    monto       = Column(Float, nullable=False)
    fecha       = Column(String, nullable=False)    # YYYY-MM-DD
    tipo        = Column(String, default="otro")    # expensa | impuesto | seguro | mantenimiento | otro
    periodo     = Column(String, nullable=True)     # YYYY-MM (opcional)
    notas       = Column(String, default="")
    created_at  = Column(DateTime, default=datetime.utcnow)

    alquiler = relationship("Alquiler", back_populates="gastos")


class Prestamo(Base):
    __tablename__ = "prestamos"

    id                    = Column(Integer, primary_key=True, index=True)
    user_id               = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    nombre                = Column(String, nullable=False)           # "Hipoteca BNA"
    tipo                  = Column(String, default="personal")       # hipotecario|personal|vehiculo|prendario|uva|otro
    entidad               = Column(String, default="")               # banco o acreedor
    monto_original        = Column(Float, nullable=False)
    moneda                = Column(String, default="ARS")            # ARS|USD|UVA
    tasa_nominal_anual    = Column(Float, default=0.0)               # TNA %
    sistema_amortizacion  = Column(String, default="frances")        # frances|aleman|cuota_fija
    cuotas_totales        = Column(Integer, nullable=False)
    fecha_inicio          = Column(String, nullable=False)           # YYYY-MM-DD (primera cuota)
    dia_pago              = Column(Integer, default=10)              # día del mes 1-28
    cargos_mensuales      = Column(Float, default=0.0)               # seguros + gastos administrativos
    numero_operacion      = Column(String, default="")               # referencia del banco (Op n° ...)
    notas                 = Column(String, default="")
    activo                = Column(Boolean, default=True)
    created_at            = Column(DateTime, default=datetime.utcnow)

    user  = relationship("User", back_populates="prestamos")
    pagos = relationship("PagoPrestamo", back_populates="prestamo", cascade="all, delete-orphan")


class PagoPrestamo(Base):
    __tablename__ = "pagos_prestamos"

    id                = Column(Integer, primary_key=True, index=True)
    prestamo_id       = Column(Integer, ForeignKey("prestamos.id"), nullable=False, index=True)
    user_id           = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    numero_cuota      = Column(Integer, nullable=False)
    fecha_vencimiento = Column(String, nullable=False)   # YYYY-MM-DD
    fecha_pago        = Column(String, nullable=True)    # YYYY-MM-DD (null si no pagada)
    monto_total       = Column(Float, nullable=False)    # capital + interes + cargos
    capital           = Column(Float, default=0.0)
    interes           = Column(Float, default=0.0)
    cargos            = Column(Float, default=0.0)       # seguros + gastos administrativos
    capital_uva       = Column(Float, nullable=True)     # valor en UVA (solo préstamos UVA)
    interes_uva       = Column(Float, nullable=True)     # valor en UVA (solo préstamos UVA)
    saldo_pendiente   = Column(Float, default=0.0)       # saldo restante tras esta cuota
    estado            = Column(String, default="pendiente")  # pagado|pendiente|atrasado
    notas             = Column(String, default="")
    created_at        = Column(DateTime, default=datetime.utcnow)

    prestamo = relationship("Prestamo", back_populates="pagos")


class NotificacionAlquiler(Base):
    __tablename__ = "notificaciones_alquileres"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    alquiler_id = Column(Integer, ForeignKey("alquileres.id"), nullable=False, index=True)
    mensaje     = Column(String, nullable=False)
    tipo        = Column(String, default="general")  # actualizacion | fin_contrato | pago_pendiente
    leida       = Column(Boolean, default=False)
    ref         = Column(String, nullable=False)     # clave única para evitar duplicados
    created_at  = Column(DateTime, default=datetime.utcnow)

    alquiler = relationship("Alquiler", back_populates="notificaciones")
    user     = relationship("User", back_populates="notificaciones_alquileres")
