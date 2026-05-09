import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", "") or SMTP_USER
APP_URL   = os.getenv("APP_URL", "http://localhost:8000")


def _is_configured() -> bool:
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASS)


def send_email(to: str, subject: str, html_body: str) -> bool:
    """Envía un email HTML. Retorna False si SMTP no está configurado o falla."""
    if not _is_configured():
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = SMTP_FROM
        msg["To"]      = to
        msg.attach(MIMEText(html_body, "html", "utf-8"))
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_FROM, [to], msg.as_string())
        return True
    except Exception as e:
        print(f"[email] Error al enviar a {to}: {e}")
        return False


def _base_template(content: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}}
  .wrap{{max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,.08);}}
  .header{{background:linear-gradient(135deg,#0ea5e9,#3b82f6);padding:28px 32px;}}
  .header h1{{margin:0;color:#fff;font-size:20px;font-weight:700;}}
  .header p{{margin:4px 0 0;color:#bfdbfe;font-size:13px;}}
  .body{{padding:28px 32px;}}
  .footer{{padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:12px;}}
  .btn{{display:inline-block;padding:12px 28px;background:#3b82f6;color:#fff!important;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:16px 0;}}
  .alert{{background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;color:#92400e;font-size:14px;margin:12px 0;}}
  .danger{{background:#fee2e2;border-color:#fca5a5;color:#991b1b;}}
  p{{color:#334155;line-height:1.6;font-size:14px;margin:0 0 12px;}}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>Finanzas Personales</h1>
    <p>by PabloFinance</p>
  </div>
  <div class="body">{content}</div>
  <div class="footer">© 2025 PabloFinance · <a href="{APP_URL}" style="color:#94a3b8;">Abrir app</a></div>
</div>
</body></html>"""


def send_password_reset(to: str, name: str, token: str) -> bool:
    reset_url = f"{APP_URL}/reset-password.html?token={token}"
    content = f"""
<p>Hola <strong>{name}</strong>,</p>
<p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
<p>Hacé clic en el botón para crear una nueva contraseña:</p>
<a href="{reset_url}" class="btn">Restablecer contraseña</a>
<div class="alert">Este enlace expira en <strong>1 hora</strong>. Si no solicitaste el cambio, podés ignorar este email.</div>
<p style="font-size:12px;color:#94a3b8;">Si el botón no funciona, copiá este link: {reset_url}</p>
"""
    return send_email(to, "Restablecer tu contraseña — Finanzas Personales", _base_template(content))


def send_service_reminder(to: str, name: str, service_name: str, amount: float, days: int, due_date: str) -> bool:
    urgency_class = "danger" if days <= 0 else "alert"
    if days <= 0:
        urgency_msg = f"⚠️ <strong>{service_name}</strong> venció el {due_date}."
    elif days == 1:
        urgency_msg = f"⏰ <strong>{service_name}</strong> vence <strong>mañana</strong> ({due_date})."
    else:
        urgency_msg = f"📅 <strong>{service_name}</strong> vence en <strong>{days} días</strong> ({due_date})."
    content = f"""
<p>Hola <strong>{name}</strong>,</p>
<p>Te recordamos que tenés un servicio próximo a vencer:</p>
<div class="alert {urgency_class}">{urgency_msg}</div>
<p>Monto: <strong>${amount:,.2f}</strong></p>
<a href="{APP_URL}/servicios.html" class="btn">Ver mis servicios</a>
"""
    subject = f"{'🚨 Servicio vencido' if days <= 0 else '⏰ Recordatorio de servicio'}: {service_name}"
    return send_email(to, subject, _base_template(content))


def send_group_invite(to: str, invitee_name: str, inviter_name: str, group_name: str, token: str) -> bool:
    invite_url = f"{APP_URL}/compartidos.html?invite={token}"
    content = f"""
<p>Hola <strong>{invitee_name}</strong>,</p>
<p><strong>{inviter_name}</strong> te invitó a unirte al grupo colaborativo <strong>"{group_name}"</strong> en Finanzas Personales.</p>
<p>En este grupo podrás cargar tus propios gastos y ver el balance actualizado con todos los integrantes.</p>
<a href="{invite_url}" class="btn">Aceptar invitación</a>
<div class="alert">Este enlace expira en <strong>7 días</strong>. Si no esperabas esta invitación, podés ignorar este email.</div>
<p style="font-size:12px;color:#94a3b8;">Si el botón no funciona, copiá este link: {invite_url}</p>
"""
    return send_email(to, f"{inviter_name} te invitó a un grupo — Finanzas Personales", _base_template(content))


def send_alquiler_reminder(to: str, name: str, nombre_alquiler: str, tipo: str, dias: int, monto: float, fecha_ref: str) -> bool:
    if tipo == "actualizacion":
        if dias == 0:
            cuando = "hoy"
        elif dias == 1:
            cuando = "mañana"
        else:
            cuando = f"en {dias} días ({fecha_ref})"
        subject = f"📈 Actualización de alquiler: {nombre_alquiler}"
        content = f"""
<p>Hola <strong>{name}</strong>,</p>
<p>Tu alquiler <strong>"{nombre_alquiler}"</strong> tiene una actualización de precio programada:</p>
<div class="alert">📈 La actualización se realiza <strong>{cuando}</strong>.</div>
<p>Valor actual: <strong>${monto:,.2f}</strong></p>
<a href="{APP_URL}/alquileres.html" class="btn">Ver alquileres</a>
"""
    elif tipo == "fin_contrato":
        if dias == 0:
            cuando = "hoy"
        else:
            cuando = f"en {dias} días ({fecha_ref})"
        subject = f"📋 Vencimiento de contrato: {nombre_alquiler}"
        content = f"""
<p>Hola <strong>{name}</strong>,</p>
<p>El contrato de alquiler <strong>"{nombre_alquiler}"</strong> vence <strong>{cuando}</strong>.</p>
<div class="alert">📋 Acordate de renovar o gestionar el vencimiento del contrato.</div>
<p>Monto actual: <strong>${monto:,.2f}</strong></p>
<a href="{APP_URL}/alquileres.html" class="btn">Ver alquileres</a>
"""
    elif tipo == "pago_pendiente":
        urgency_class = "danger" if dias > 0 else "alert"
        if dias == 0:
            msg = f"🏠 El pago de <strong>{nombre_alquiler}</strong> vence hoy."
        else:
            msg = f"⚠️ El pago de <strong>{nombre_alquiler}</strong> lleva <strong>{dias} días</strong> de atraso."
        subject = f"{'🚨 Pago atrasado' if dias > 0 else '⏰ Pago de alquiler hoy'}: {nombre_alquiler}"
        content = f"""
<p>Hola <strong>{name}</strong>,</p>
<div class="alert {urgency_class}">{msg}</div>
<p>Monto: <strong>${monto:,.2f}</strong></p>
<a href="{APP_URL}/alquileres.html" class="btn">Ver alquileres</a>
"""
    else:
        return False
    return send_email(to, subject, _base_template(content))


def send_debt_reminder(to: str, name: str, person_name: str, amount: float, debt_type: str, days: int, due_date: str) -> bool:
    direction = "le debés a" if debt_type == "owe" else "te debe"
    urgency_class = "danger" if days <= 0 else "alert"
    if days <= 0:
        msg = f"⚠️ La deuda que <strong>{direction} {person_name}</strong> venció el {due_date}."
    elif days == 1:
        msg = f"⏰ La deuda que <strong>{direction} {person_name}</strong> vence <strong>mañana</strong>."
    else:
        msg = f"📅 La deuda que <strong>{direction} {person_name}</strong> vence en <strong>{days} días</strong> ({due_date})."
    content = f"""
<p>Hola <strong>{name}</strong>,</p>
<p>Recordatorio sobre una deuda pendiente:</p>
<div class="alert {urgency_class}">{msg}</div>
<p>Monto: <strong>${amount:,.2f}</strong></p>
<a href="{APP_URL}/debts.html" class="btn">Ver mis deudas</a>
"""
    subject = f"Recordatorio de deuda: {person_name}"
    return send_email(to, subject, _base_template(content))
