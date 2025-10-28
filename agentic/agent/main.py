# agent/main.py
import os
from datetime import datetime, date
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel

from .models import (
    BookingContext,
    ConciergeAsk,
    ConciergeChatRequest,
    ConciergeChatResponse,
    ConciergeResponse,
    Preferences,
)
from .db import (
    append_chat_message,
    ensure_chat_table,
    get_booking_with_user,
    get_chat_history,
    get_traveler_prefs,
)
from .providers.weather import get_weather_daily
from .planner import generate_concierge
from .chat_agent import run_concierge_chat

load_dotenv()

app = FastAPI(title="AI Concierge Agent")

# allow your React origin(s)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","http://127.0.0.1:3000"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"]
)

def _coerce_date(value: Any) -> date:
    if value is None:
        raise ValueError("date value required")
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    try:
        return datetime.fromisoformat(str(value)).date()
    except Exception as exc:  # pragma: no cover - defensive
        raise ValueError("invalid date format") from exc


async def _build_concierge_response(ask: ConciergeAsk) -> ConciergeResponse:
    # 1) if booking_id present, hydrate from DB
    booking = ask.booking
    if booking.booking_id and not booking.location:
        row = get_booking_with_user(booking.booking_id)
        if not row: raise HTTPException(404, "Booking not found")
        booking.location = row["location"]
        booking.guests = booking.guests or row["guests"]
        booking.party_type = booking.party_type or row["party_type"]

    if not booking.location:
        raise HTTPException(400, "location required (in booking or via booking_id)")

    # 2) geocoding is out-of-scope here; if lat/lon missing, skip weather gracefully
    weather = None
    if booking.lat is not None and booking.lon is not None:
        try:
            weather = await get_weather_daily(booking.lat, booking.lon)
        except Exception:
            weather = None  # don't fail the whole request

    # 3) if prefs not provided, try DB
    if ask.prefs is None and booking.booking_id:
        br = get_booking_with_user(booking.booking_id)
        if br:
            prefs = get_traveler_prefs(br["traveler_id"])
            if prefs:
                ask.prefs = Preferences(**prefs)

    # 4) generate
    return await generate_concierge(ask, weather_daily=weather)


@app.post("/ai/concierge", response_model=ConciergeResponse)
async def concierge(ask: ConciergeAsk):
    return await _build_concierge_response(ask)


@app.post("/ai/concierge/chat", response_model=ConciergeChatResponse)
async def concierge_chat(req: ConciergeChatRequest):
    reply = await run_concierge_chat(
        [msg.model_dump() for msg in req.messages],
        req.context or {}
    )
    return ConciergeChatResponse(reply=reply)


class LegacyChatRequest(BaseModel):
    booking: Optional[Dict[str, Any]] = None
    message: str
    prefs: Optional[Dict[str, Any]] = None
    history: Optional[List[Dict[str, Any]]] = None


@app.post("/ai/chat")
async def concierge_chat_legacy(payload: LegacyChatRequest):
    if not payload.booking:
        raise HTTPException(400, "booking is required")

    booking_raw = payload.booking
    start_raw = booking_raw.get("start_date") or booking_raw.get("startDate")
    end_raw = booking_raw.get("end_date") or booking_raw.get("endDate")
    if not start_raw or not end_raw:
        raise HTTPException(400, "start_date and end_date are required")

    try:
        booking = BookingContext(
            booking_id=booking_raw.get("booking_id") or booking_raw.get("id"),
            location=booking_raw.get("location"),
            lat=booking_raw.get("lat"),
            lon=booking_raw.get("lon"),
            start_date=_coerce_date(start_raw),
            end_date=_coerce_date(end_raw),
            party_type=booking_raw.get("party_type") or booking_raw.get("partyType"),
            guests=booking_raw.get("guests"),
        )
    except Exception as exc:
        raise HTTPException(400, f"invalid booking payload: {exc}") from exc

    prefs_model: Optional[Preferences] = None
    if payload.prefs:
        try:
            prefs_model = Preferences(**payload.prefs)
        except Exception as exc:
            raise HTTPException(400, f"invalid prefs payload: {exc}") from exc

    ask = ConciergeAsk(booking=booking, prefs=prefs_model, free_text=payload.message)
    concierge = await _build_concierge_response(ask)

    # Persist conversation if DB is available
    ensure_chat_table()
    if booking.booking_id:
        append_chat_message(booking.booking_id, "user", payload.message)

    history_messages = payload.history or []
    chat_messages = []
    for item in history_messages:
        role = item.get("role")
        content = item.get("content") or item.get("text")
        if role in ("user", "assistant") and content:
            chat_messages.append({"role": role, "content": content})
    chat_messages.append({"role": "user", "content": payload.message})

    try:
        reply = await run_concierge_chat(chat_messages, {"active_booking": booking_raw})
    except Exception:
        reply = "Here is your updated concierge plan."

    if booking.booking_id:
        append_chat_message(booking.booking_id, "assistant", reply)

    return {
        "reply": reply,
        "concierge": concierge.model_dump(mode="json"),
    }


@app.get("/ai/health")
async def health():
    from .providers import llm as llmprov
    return {
        "ok": True,
        "model": getattr(llmprov, "MODEL_NAME", None),
        "gemini_key_present": bool(os.getenv("GEMINI_API_KEY")),
        "tavily_key_present": bool(os.getenv("TAVILY_API_KEY")),
        "openweather_key_present": bool(os.getenv("OPENWEATHER_API_KEY")),
    }


@app.get("/ai/history")
async def history(booking_id: Optional[int] = None, limit: int = 200):
    if not booking_id:
        return {"history": []}
    ensure_chat_table()
    rows = get_chat_history(booking_id, limit=limit)
    return {"history": rows}
