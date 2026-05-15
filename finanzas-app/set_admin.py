"""
Activa o desactiva el rol de administrador para un usuario.

Uso:
    python set_admin.py pablodomenez@gmail.com
    python set_admin.py pablodomenez@gmail.com --remove
"""
import sys
from database import SessionLocal
import models


def set_admin(email: str, remove: bool = False):
    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            print(f"Error: no se encontró ningún usuario con email '{email}'")
            sys.exit(1)
        user.is_admin = not remove
        db.commit()
        action = "eliminado de" if remove else "asignado a"
        print(f"OK Rol de admin {action}: {user.name} <{user.email}> (id={user.id})")
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python set_admin.py <email> [--remove]")
        sys.exit(1)
    email_arg = sys.argv[1]
    remove_flag = "--remove" in sys.argv
    set_admin(email_arg, remove_flag)
