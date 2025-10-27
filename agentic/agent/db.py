# agent/db.py
import os

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DEFAULT_DB_URL = "sqlite+pysqlite:///:memory:"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DB_URL)

engine = None
SessionLocal = None
_db_error: Exception | None = None

if DATABASE_URL:
    try:
        engine = create_engine(DATABASE_URL, pool_pre_ping=True, future=True)
        SessionLocal = sessionmaker(bind=engine)
    except Exception as exc:  # pragma: no cover - diagnostic only
        _db_error = exc
        engine = None
        SessionLocal = None

def get_booking_with_user(booking_id:int):
    """
    Expect your schema to have:
      bookings(id, traveler_id, property_id, location, start_date, end_date, guests, party_type, status)
      users(id, name, email, phone, ... )
      properties(id, owner_id, location, ...)
    Adjust SELECT to your real table/column names.
    """
    if SessionLocal is None:
        return None
    with SessionLocal() as s:
        try:
            row = s.execute(text("""
                SELECT b.id, b.traveler_id, b.location, b.start_date, b.end_date, b.guests, b.party_type,
                       u.name as traveler_name
                FROM bookings b
                JOIN users u ON u.id = b.traveler_id
                WHERE b.id = :bid
            """), {"bid": booking_id}).mappings().first()
        except Exception:
            return None
        return dict(row) if row else None

def get_traveler_prefs(traveler_id:int):
    if SessionLocal is None:
        return None
    with SessionLocal() as s:
        try:
            row = s.execute(text("""
                SELECT budget, interests, mobility_needs, dietary
                FROM traveler_preferences
                WHERE traveler_id = :tid
                ORDER BY updated_at DESC
                LIMIT 1
            """), {"tid": traveler_id}).mappings().first()
        except Exception:
            return None
        return dict(row) if row else None
