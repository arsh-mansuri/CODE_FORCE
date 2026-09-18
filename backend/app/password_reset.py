from email.message import EmailMessage
import smtplib
import ssl
from urllib.parse import quote

from .config import Settings
from .security import problem


def require_reset_email(settings: Settings):
    if not settings.smtp_host or not settings.smtp_from:
        raise problem(503, "email_unavailable", "Password reset email is not configured yet. Please try again later.")


def send_reset_email(settings: Settings, email: str, token: str):
    require_reset_email(settings)
    # The fragment keeps the token out of HTTP requests and referrer headers.
    link = f"{settings.frontend_url}/#reset-password={quote(token)}"
    message = EmailMessage()
    message["Subject"] = "Reset your PropVibe password"
    message["From"] = settings.smtp_from
    message["To"] = email
    message.set_content(
        f"Let's get you back home.\n\nChoose a new password: {link}\n\n"
        "This link expires in 30 minutes and can only be used once. "
        "If you didn't request this, you can ignore this email."
    )
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            if settings.smtp_starttls:
                smtp.starttls(context=ssl.create_default_context())
            if settings.smtp_username:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException):
        raise problem(503, "email_unavailable", "We couldn't send the reset email. Please try again shortly.") from None
