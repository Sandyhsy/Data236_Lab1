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


    def ensure_chat_table():
        """Create a simple chat_history table if it doesn't exist.
        Columns: id (autoinc), booking_id (int), role (text), message (text), created_at (timestamp).
        """
        if SessionLocal is None or engine is None:
            return False
        with engine.begin() as conn:
            conn.exec_driver_sql("""
            CREATE TABLE IF NOT EXISTS chat_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                booking_id INTEGER,
                role TEXT,
                message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """)
        return True


    def append_chat_message(booking_id:int, role:str, message:str):
        if SessionLocal is None:
            return False
        with SessionLocal() as s:
            try:
                s.execute(text("INSERT INTO chat_history (booking_id, role, message) VALUES (:bid, :role, :msg)"), {"bid": booking_id, "role": role, "msg": message})
                s.commit()
            except Exception:
                return False
        return True


    def get_chat_history(booking_id:int, limit:int=200):
        if SessionLocal is None:
            return []
        with SessionLocal() as s:
            try:
                rows = s.execute(text("SELECT role, message, created_at FROM chat_history WHERE booking_id = :bid ORDER BY id ASC LIMIT :lim"), {"bid": booking_id, "lim": limit}).mappings().all()
            except Exception:
                return []
        return [dict(r) for r in rows]
