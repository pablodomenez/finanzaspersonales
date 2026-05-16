"""
Script para crear usuario demo con datos realistas para videos/marketing.
Usuario: demo@finanzasapp.com / Demo1234!
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, date
from dateutil.relativedelta import relativedelta
from passlib.context import CryptContext
from database import SessionLocal, engine, Base
import models

# Crear tablas si no existen
Base.metadata.create_all(bind=engine)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DEMO_EMAIL = "demo@finanzasapp.com"
DEMO_PASSWORD = "Demo1234!"
DEMO_NAME = "Martín García"

TODAY = date(2026, 5, 16)
NOW = datetime(2026, 5, 16, 10, 0, 0)


def d(year, month, day):
    return datetime(year, month, day)


def run_migrations():
    """Aplica las migraciones pendientes de main.py antes de insertar datos."""
    from sqlalchemy import text
    sqls = [
        "ALTER TABLE prestamos ADD COLUMN cargos_mensuales REAL DEFAULT 0",
        "ALTER TABLE prestamos ADD COLUMN numero_operacion TEXT DEFAULT ''",
        "ALTER TABLE pagos_prestamos ADD COLUMN cargos REAL DEFAULT 0",
        "ALTER TABLE pagos_prestamos ADD COLUMN capital_uva REAL",
        "ALTER TABLE pagos_prestamos ADD COLUMN interes_uva REAL",
        "ALTER TABLE servicios ADD COLUMN numero_cuenta TEXT DEFAULT ''",
        "ALTER TABLE servicios ADD COLUMN link_pago TEXT DEFAULT ''",
        "ALTER TABLE servicios ADD COLUMN monto_variable INTEGER DEFAULT 0",
        "ALTER TABLE inversiones ADD COLUMN notas_tesis TEXT DEFAULT ''",
        "ALTER TABLE inversiones ADD COLUMN ticker TEXT DEFAULT ''",
        "ALTER TABLE transactions ADD COLUMN payment_method TEXT",
        "ALTER TABLE card_expenses ADD COLUMN expense_type TEXT DEFAULT 'cuota'",
        "ALTER TABLE card_expenses ADD COLUMN end_month INTEGER",
        "ALTER TABLE card_expenses ADD COLUMN end_year INTEGER",
        "ALTER TABLE users ADD COLUMN google_id TEXT",
        "ALTER TABLE users ADD COLUMN terms_accepted_at TIMESTAMP",
        "ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1",
        "ALTER TABLE users ADD COLUMN totp_secret TEXT",
        "ALTER TABLE users ADD COLUMN totp_enabled INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN onboarding_done INTEGER DEFAULT 0",
    ]
    with engine.connect() as conn:
        for sql in sqls:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                conn.rollback()


def run():
    run_migrations()
    db = SessionLocal()
    try:
        # ── Limpiar usuario anterior si existe ─────────────────────────────
        existing = db.query(models.User).filter_by(email=DEMO_EMAIL).first()
        if existing:
            db.delete(existing)
            db.commit()
            print("Usuario demo anterior eliminado.")

        # ── 1. Crear usuario ───────────────────────────────────────────────
        user = models.User(
            email=DEMO_EMAIL,
            name=DEMO_NAME,
            hashed_password=pwd_context.hash(DEMO_PASSWORD),
            created_at=d(2025, 11, 3),
            onboarding_done=True,
            terms_accepted_at=d(2025, 11, 3),
            is_active=True,
        )
        db.add(user)
        db.flush()
        uid = user.id
        print(f"Usuario creado: id={uid}")

        # ── 2. Perfil ──────────────────────────────────────────────────────
        db.add(models.UserProfile(
            user_id=uid,
            phone="+54 9 11 5523-8841",
            birth_date="1992-07-14",
            country="Argentina",
            currency="ARS",
            occupation="Desarrollador de Software",
            bio="Aprendiendo a ordenar mis finanzas personales 💪",
            avatar_emoji="👨‍💻",
        ))

        # ── 3. Transacciones (Nov 2025 – May 2026) ────────────────────────
        txns = [
            # NOV 2025
            (1,  "income", 1_450_000, "Sueldo noviembre",         d(2025,11,5)),
            (2,  "income",   180_000, "Proyecto web freelance",   d(2025,11,12)),
            (5,  "expense",   95_000, "Supermercado Coto",        d(2025,11,7)),
            (5,  "expense",   42_000, "Delivery pizza",           d(2025,11,14)),
            (7,  "expense",  380_000, "Alquiler noviembre",       d(2025,11,1)),
            (6,  "expense",   28_000, "SUBE y Uber",              d(2025,11,10)),
            (13, "expense",   15_000, "Internet Fibertel",        d(2025,11,5)),
            (10, "expense",   25_000, "Netflix + Spotify",        d(2025,11,3)),
            (8,  "expense",   18_500, "Farmacia",                 d(2025,11,18)),
            (12, "expense",   80_000, "Ahorro noviembre",         d(2025,11,30)),

            # DIC 2025
            (1,  "income", 1_450_000, "Sueldo diciembre",         d(2025,12,5)),
            (1,  "income",   200_000, "SAC (aguinaldo)",          d(2025,12,18)),
            (2,  "income",   250_000, "Proyecto app móvil",       d(2025,12,10)),
            (5,  "expense",  130_000, "Supermercado diciembre",   d(2025,12,8)),
            (7,  "expense",  380_000, "Alquiler diciembre",       d(2025,12,1)),
            (11, "expense",  145_000, "Ropa navidad + regalos",   d(2025,12,20)),
            (10, "expense",   85_000, "Cena fin de año",          d(2025,12,31)),
            (6,  "expense",   32_000, "Uber/remis fiestas",       d(2025,12,24)),
            (13, "expense",   16_500, "Internet + gas",           d(2025,12,5)),
            (12, "expense",  100_000, "Ahorro diciembre",         d(2025,12,29)),

            # ENE 2026
            (1,  "income", 1_580_000, "Sueldo enero",             d(2026,1,5)),
            (2,  "income",   120_000, "Consultoría IT",           d(2026,1,20)),
            (5,  "expense",  105_000, "Supermercado enero",       d(2026,1,9)),
            (7,  "expense",  420_000, "Alquiler enero (aumento)", d(2026,1,1)),
            (10, "expense",  180_000, "Vacaciones Mar del Plata", d(2026,1,15)),
            (6,  "expense",   55_000, "Nafta viaje",              d(2026,1,14)),
            (13, "expense",   16_500, "Internet",                 d(2026,1,5)),
            (8,  "expense",   22_000, "Médico clínico",           d(2026,1,22)),
            (12, "expense",  120_000, "Ahorro enero",             d(2026,1,31)),

            # FEB 2026
            (1,  "income", 1_580_000, "Sueldo febrero",           d(2026,2,5)),
            (3,  "income",   145_000, "Renta plazo fijo",         d(2026,2,28)),
            (5,  "expense",  112_000, "Supermercado febrero",     d(2026,2,7)),
            (7,  "expense",  420_000, "Alquiler febrero",         d(2026,2,1)),
            (9,  "expense",   95_000, "Curso Python avanzado",    d(2026,2,10)),
            (8,  "expense",   35_000, "Dentista",                 d(2026,2,14)),
            (11, "expense",   68_000, "Ropa verano",              d(2026,2,20)),
            (13, "expense",   18_000, "Internet + Luz",           d(2026,2,5)),
            (6,  "expense",   31_000, "Transporte",               d(2026,2,15)),
            (12, "expense",  130_000, "Ahorro febrero",           d(2026,2,28)),

            # MAR 2026
            (1,  "income", 1_580_000, "Sueldo marzo",             d(2026,3,5)),
            (2,  "income",   350_000, "Proyecto e-commerce",      d(2026,3,18)),
            (5,  "expense",  120_000, "Supermercado marzo",       d(2026,3,8)),
            (7,  "expense",  420_000, "Alquiler marzo",           d(2026,3,1)),
            (6,  "expense",   42_000, "SUBE + Uber",              d(2026,3,12)),
            (15, "expense",   28_000, "Veterinario Luna",         d(2026,3,10)),
            (8,  "expense",   45_000, "Análisis clínicos",        d(2026,3,20)),
            (13, "expense",   18_000, "Servicios marzo",          d(2026,3,5)),
            (9,  "expense",   75_000, "Udemy cursos",             d(2026,3,22)),
            (10, "expense",   55_000, "Cine y salidas",           d(2026,3,25)),
            (12, "expense",  150_000, "Ahorro marzo",             d(2026,3,31)),

            # ABR 2026
            (1,  "income", 1_720_000, "Sueldo abril (aumento)",   d(2026,4,5)),
            (2,  "income",   200_000, "Mantenimiento web cliente", d(2026,4,14)),
            (5,  "expense",  135_000, "Supermercado abril",       d(2026,4,7)),
            (7,  "expense",  460_000, "Alquiler abril",           d(2026,4,1)),
            (6,  "expense",   48_000, "Nafta + Uber",             d(2026,4,10)),
            (10, "expense",   72_000, "Teatro + salidas",         d(2026,4,18)),
            (8,  "expense",   28_000, "Farmacia",                 d(2026,4,22)),
            (13, "expense",   20_000, "Internet + Gas",           d(2026,4,5)),
            (11, "expense",   55_000, "Campera otoño",            d(2026,4,26)),
            (12, "expense",  160_000, "Ahorro abril",             d(2026,4,30)),

            # MAY 2026
            (1,  "income", 1_720_000, "Sueldo mayo",              d(2026,5,5)),
            (5,  "expense",  128_000, "Supermercado mayo",        d(2026,5,3)),
            (7,  "expense",  460_000, "Alquiler mayo",            d(2026,5,1)),
            (6,  "expense",   38_000, "Transporte mayo",          d(2026,5,8)),
            (13, "expense",   20_000, "Servicios mayo",           d(2026,5,5)),
            (8,  "expense",   32_000, "Médico",                   d(2026,5,12)),
            (10, "expense",   45_000, "Entretenimiento",          d(2026,5,10)),
        ]
        for cat_id, ttype, amount, desc, dt in txns:
            db.add(models.Transaction(
                user_id=uid,
                category_id=cat_id,
                amount=amount,
                type=ttype,
                description=desc,
                date=dt,
            ))

        # ── 4. Presupuestos mayo 2026 ──────────────────────────────────────
        budgets = [
            (5,  180_000),   # Comida
            (6,   60_000),   # Transporte
            (7,  460_000),   # Vivienda
            (8,   50_000),   # Salud
            (9,   80_000),   # Educación
            (10,  80_000),   # Entretenimiento
            (11,  70_000),   # Ropa
            (12, 200_000),   # Ahorro
            (13,  25_000),   # Servicios
            (15,  30_000),   # Mascotas
        ]
        for cat_id, limit in budgets:
            db.add(models.Budget(
                user_id=uid,
                category_id=cat_id,
                month=5,
                year=2026,
                limit_amount=limit,
            ))

        # ── 5. Metas de ahorro ─────────────────────────────────────────────
        goals = [
            ("Viaje a Europa ✈️",    "✈️",  4_500_000,  1_280_000, datetime(2026, 12, 1)),
            ("Fondo de emergencia", "🛡️",  2_000_000,    980_000, datetime(2026, 8, 1)),
            ("Auto nuevo 🚗",        "🚗", 12_000_000,  2_100_000, datetime(2027, 6, 1)),
            ("MacBook Pro 💻",       "💻",  1_800_000,  1_350_000, datetime(2026, 7, 1)),
        ]
        for name, icon, target, current, deadline in goals:
            db.add(models.Goal(
                user_id=uid,
                name=name,
                icon=icon,
                target_amount=target,
                current_amount=current,
                deadline=deadline,
            ))

        # ── 6. Deudas ──────────────────────────────────────────────────────
        debts = [
            # (person, desc, amount, type, due_date, paid)
            ("Lucas Fernández", "Le presté para el alquiler", 150_000, "owed", datetime(2026,6,1),  False),
            ("Sofía Martínez",  "Mitad de la cena de cumple", 45_000,  "owed", datetime(2026,5,25), False),
            ("Banco Galicia",   "Cuota préstamo personal",    185_000, "owe",  datetime(2026,5,20), True),
            ("Mamá",            "Plata prestada emergencia",  300_000, "owe",  datetime(2026,7,1),  False),
            ("Diego Ruiz",      "Apuesta partido",             20_000, "owed", None,                True),
        ]
        for person, desc, amount, dtype, due, paid in debts:
            db.add(models.Debt(
                user_id=uid,
                person_name=person,
                description=desc,
                amount=amount,
                type=dtype,
                due_date=due,
                paid=paid,
            ))

        # ── 7. Tarjetas de crédito ─────────────────────────────────────────
        visa = models.CreditCard(
            user_id=uid,
            name="Visa Galicia",
            bank="Banco Galicia",
            last_four="4521",
            credit_limit=2_000_000,
            closing_day=20,
            due_day=5,
            color="#1a56db",
        )
        master = models.CreditCard(
            user_id=uid,
            name="Mastercard Santander",
            bank="Banco Santander",
            last_four="8834",
            credit_limit=1_500_000,
            closing_day=15,
            due_day=1,
            color="#e3a008",
        )
        db.add(visa)
        db.add(master)
        db.flush()

        # Gastos en tarjetas
        card_expenses = [
            # (card, desc, total, cuotas, first_month, first_year)
            (visa.id,   "Smart TV Samsung 55\"",   750_000,  12, 2, 2026),
            (visa.id,   "Vuelos Buenos Aires-Bariloche", 320_000, 6, 3, 2026),
            (visa.id,   "Suscripción Adobe CC",     45_000,  1,  5, 2026),
            (visa.id,   "Auriculares Sony WH-1000", 285_000,  3,  4, 2026),
            (master.id, "Heladera Whirlpool",       980_000, 18,  1, 2026),
            (master.id, "Seguro del auto",           95_000,  1,  5, 2026),
            (master.id, "Cena Restaurant Puerto Madero", 68_000, 1, 5, 2026),
            (master.id, "Curso de trading online",  180_000,  3,  3, 2026),
        ]
        for card_id, desc, total, cuotas, fm, fy in card_expenses:
            db.add(models.CardExpense(
                user_id=uid,
                card_id=card_id,
                description=desc,
                total_amount=total,
                installments=cuotas,
                expense_type="cuota",
                first_payment_month=fm,
                first_payment_year=fy,
            ))

        # ── 8. Servicios recurrentes ───────────────────────────────────────
        services = [
            # (nombre, cat, monto, dia_vto, frecuencia)
            ("Netflix",          "Streaming",     10_500,  5,  "mensual"),
            ("Spotify",          "Streaming",      4_800,  5,  "mensual"),
            ("Fibertel/Claro",   "Internet",      19_900, 10,  "mensual"),
            ("Gym SportClub",    "Salud",         32_000, 1,   "mensual"),
            ("Adobe Creative",   "Software",      45_000, 15,  "mensual"),
            ("Seguro de vida",   "Seguros",       28_500, 20,  "mensual"),
            ("GitHub Copilot",   "Software",      12_000,  1,  "mensual"),
            ("Disney+",          "Streaming",      8_200,  5,  "mensual"),
            ("Expensas",         "Vivienda",      95_000,  5,  "mensual"),
        ]
        for nombre, cat, monto, dia, frec in services:
            prox = f"2026-05-{dia:02d}" if dia >= 16 else f"2026-06-{dia:02d}"
            db.add(models.Servicio(
                user_id=uid,
                nombre=nombre,
                categoria=cat,
                monto=monto,
                dia_vencimiento=dia,
                frecuencia=frec,
                activo=True,
                proximo_vencimiento=prox,
            ))

        # ── 9. Inversiones ─────────────────────────────────────────────────
        inversiones_data = [
            # (tipo, nombre, moneda, invertido, actual, inicio, vto, tasa, estado, ticker)
            ("plazo_fijo", "PF Galicia 30 días",     "ARS", 800_000,  916_000, "2026-04-16", "2026-05-16", 68.5, "activo",  ""),
            ("cedears",    "Apple Inc. (AAPL)",        "USD",  82_500,  103_200, "2025-11-10", None,         None, "activo",  "AAPL"),
            ("cedears",    "MercadoLibre (MELI)",      "USD",  45_000,   62_800, "2025-12-5",  None,         None, "activo",  "MELI"),
            ("fci",        "FCI Balanz Capital",       "ARS", 500_000,  672_000, "2026-01-15", None,         None, "activo",  ""),
            ("cripto",     "Bitcoin (BTC)",            "USD",  60_000,   88_500, "2025-10-20", None,         None, "activo",  "bitcoin"),
            ("cripto",     "Ethereum (ETH)",           "USD",  25_000,   31_200, "2025-10-20", None,         None, "activo",  "ethereum"),
            ("bonos",      "AL30 - Bono Argentina",   "USD",  30_000,   34_800, "2026-02-10", "2030-07-09", 8.5,  "activo",  "AL30"),
            ("dolar",      "Dólar MEP / Reserva",     "USD", 150_000,  150_000, "2025-09-01", None,         None, "activo",  ""),
        ]
        for tipo, nombre, moneda, invertido, actual, inicio, vto, tasa, estado, ticker in inversiones_data:
            inv = models.Inversion(
                user_id=uid,
                tipo=tipo,
                nombre=nombre,
                moneda=moneda,
                monto_invertido=invertido,
                valor_actual=actual,
                fecha_inicio=inicio,
                fecha_vencimiento=vto,
                tasa_anual=tasa,
                estado=estado,
                ticker=ticker,
            )
            db.add(inv)
        db.flush()

        # Histórico de algunas inversiones (últimos 3 meses)
        inv_ids = db.query(models.Inversion.id).filter_by(user_id=uid).all()
        for inv_id_tuple in inv_ids[:4]:
            inv_id = inv_id_tuple[0]
            for i, (mes, año) in enumerate([(3,2026),(4,2026),(5,2026)]):
                db.add(models.HistoricoInversion(
                    user_id=uid,
                    inversion_id=inv_id,
                    valor=800_000 + i * 38_000 + inv_id * 1000,
                    fecha=f"{año}-{mes:02d}-01",
                ))

        # Perfil inversor
        db.add(models.InversorPerfil(
            user_id=uid,
            perfil="moderado",
            puntaje=62,
            respuestas='[2,3,2,3,2,3,2]',
        ))

        # ── 10. Préstamo personal ─────────────────────────────────────────
        prestamo = models.Prestamo(
            user_id=uid,
            nombre="Préstamo personal Galicia",
            tipo="personal",
            entidad="Banco Galicia",
            monto_original=3_000_000,
            moneda="ARS",
            tasa_nominal_anual=89.0,
            sistema_amortizacion="frances",
            cuotas_totales=24,
            fecha_inicio="2025-06-10",
            dia_pago=10,
            cargos_mensuales=8_500,
            numero_operacion="OP-2025-448821",
            activo=True,
        )
        db.add(prestamo)
        db.flush()

        # Cuotas del préstamo (pagas Nov 2025 – May 2026, pendientes restantes)
        cuota_base = 185_000
        saldo = 3_000_000
        for i in range(1, 25):
            mes_inicio = date(2025, 6, 1) + relativedelta(months=i - 1)
            pagado = i <= 11   # cuotas 1-11 pagadas (jun 2025 – abr 2026)
            capital_cuota = cuota_base * 0.55
            interes_cuota = cuota_base * 0.45
            saldo = max(0, saldo - capital_cuota)
            db.add(models.PagoPrestamo(
                prestamo_id=prestamo.id,
                user_id=uid,
                numero_cuota=i,
                fecha_vencimiento=f"{mes_inicio.year}-{mes_inicio.month:02d}-10",
                fecha_pago=f"{mes_inicio.year}-{mes_inicio.month:02d}-10" if pagado else None,
                monto_total=cuota_base + 8_500,
                capital=capital_cuota,
                interes=interes_cuota,
                cargos=8_500,
                saldo_pendiente=saldo,
                estado="pagado" if pagado else "pendiente",
            ))

        # ── 11. Alquiler (como inquilino) ─────────────────────────────────
        alquiler = models.Alquiler(
            user_id=uid,
            nombre="Dpto 2 amb. Palermo",
            direccion="Thames 1420 piso 4 dto B, CABA",
            contraparte_nombre="Roberto Sánchez (prop.)",
            rol="inquilino",
            valor_actual=460_000,
            moneda="ARS",
            fecha_inicio="2024-05-01",
            fecha_fin_contrato="2026-04-30",
            dia_pago=1,
            indice_actualizacion="ICL",
            periodo_actualizacion_meses=3,
            proxima_actualizacion="2026-08-01",
            valor_inmueble=85_000_000,
            activo=True,
        )
        db.add(alquiler)
        db.flush()

        # Pagos de alquiler
        for i, (mes, año, monto, estado) in enumerate([
            (11, 2025, 380_000, "pagado"),
            (12, 2025, 380_000, "pagado"),
            (1,  2026, 420_000, "pagado"),
            (2,  2026, 420_000, "pagado"),
            (3,  2026, 420_000, "pagado"),
            (4,  2026, 460_000, "pagado"),
            (5,  2026, 460_000, "pendiente"),
        ]):
            db.add(models.PagoAlquiler(
                alquiler_id=alquiler.id,
                periodo=f"{año}-{mes:02d}",
                monto_esperado=monto,
                monto_pagado=monto if estado == "pagado" else None,
                fecha_pago=f"{año}-{mes:02d}-01" if estado == "pagado" else None,
                estado=estado,
            ))

        # Actualización de alquiler (enero 2026)
        db.add(models.ActualizacionAlquiler(
            alquiler_id=alquiler.id,
            fecha="2026-01-01",
            valor_anterior=380_000,
            valor_nuevo=420_000,
            indice_usado="ICL",
            porcentaje_aplicado=10.53,
        ))
        db.add(models.ActualizacionAlquiler(
            alquiler_id=alquiler.id,
            fecha="2026-04-01",
            valor_anterior=420_000,
            valor_nuevo=460_000,
            indice_usado="ICL",
            porcentaje_aplicado=9.52,
        ))

        db.commit()
        print("=" * 55)
        print("✅  Usuario demo creado exitosamente.")
        print(f"   Email:    {DEMO_EMAIL}")
        print(f"   Password: {DEMO_PASSWORD}")
        print("   Secciones pobladas:")
        print("   • Transacciones (Nov 2025 – May 2026)")
        print("   • Presupuestos (mayo 2026)")
        print("   • Metas de ahorro (4 metas)")
        print("   • Deudas (5 registros)")
        print("   • Tarjetas de crédito (Visa + Mastercard)")
        print("   • Servicios recurrentes (9 servicios)")
        print("   • Inversiones (8 activos)")
        print("   • Préstamo personal (24 cuotas)")
        print("   • Alquiler Palermo (con historial y actualizaciones)")
        print("=" * 55)

    except Exception as e:
        db.rollback()
        print(f"ERROR: {e}")
        import traceback; traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    run()
