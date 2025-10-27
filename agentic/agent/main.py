# agent/main.py
import os, asyncio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .models import ConciergeAsk, ConciergeResponse
from .db import get_booking_with_user, get_traveler_prefs
from .providers.weather import get_weather_daily
from .planner import generate_concierge

load_dotenv()

app = FastAPI(title="AI Concierge Agent")

# allow your React origin(s)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","http://127.0.0.1:3000"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"]
)

@app.post("/ai/concierge", response_model=ConciergeResponse)
async def concierge(ask: ConciergeAsk):
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
                from .models import Preferences
                ask.prefs = Preferences(**prefs)

    # 4) generate
    resp = await generate_concierge(ask, weather_daily=weather)
    return resp
