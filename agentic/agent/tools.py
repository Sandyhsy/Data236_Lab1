import asyncio
import json
import os
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import text
import httpx

from .db import SessionLocal
from .planner import generate_concierge
from .models import BookingContext, ConciergeAsk, Preferences
from .providers.search import search_pois
from .providers.weather import get_weather_daily


def _run_async(coro):
  loop = asyncio.new_event_loop()
  try:
    return loop.run_until_complete(coro)
  finally:
    loop.close()


def _serialize_rows(rows: List[Dict[str, Any]]) -> str:
  if not rows:
    return "No records found."
  return json.dumps(rows, default=str)


def lookup_booking_tool(
  booking_id: Optional[int] = None,
  traveler_id: Optional[int] = None
) -> str:
  """
  Fetch booking details from the database.
  """
  if booking_id is None and traveler_id is None:
    return "Please provide a booking_id or traveler_id for lookup."
  if SessionLocal is None:
    return "Database connection unavailable."

  with SessionLocal() as session:
    if booking_id is not None:
      rows = session.execute(text("""
        SELECT b.booking_id, b.traveler_id, b.property_id, b.start_date, b.end_date,
               b.guests, b.status, p.name AS property_name, p.location
        FROM bookings b
        LEFT JOIN properties p ON p.property_id = b.property_id
        WHERE b.booking_id = :bid
      """), {"bid": booking_id}).mappings().all()
    else:
      rows = session.execute(text("""
        SELECT b.booking_id, b.traveler_id, b.property_id, b.start_date, b.end_date,
               b.guests, b.status, p.name AS property_name, p.location
        FROM bookings b
        LEFT JOIN properties p ON p.property_id = b.property_id
        WHERE b.traveler_id = :tid
        ORDER BY b.start_date DESC
        LIMIT 5
      """), {"tid": traveler_id}).mappings().all()

  return _serialize_rows([dict(r) for r in rows])


def favorites_lookup_tool(traveler_id: int) -> str:
  """
  List a traveler's favorite properties.
  """
  if SessionLocal is None:
    return "Database connection unavailable."
  with SessionLocal() as session:
    rows = session.execute(text("""
      SELECT f.favorite_id, p.property_id, p.name, p.location, p.price_per_night
      FROM favorites f
      JOIN properties p ON p.property_id = f.property_id
      WHERE f.traveler_id = :tid
      ORDER BY f.favorite_id DESC
      LIMIT 10
    """), {"tid": traveler_id}).mappings().all()
  return _serialize_rows([dict(r) for r in rows])


def tavily_search_tool(location: str, query: str, max_results: int = 6) -> str:
  """
  Use Tavily (or offline fallback) to search for POIs/events related to a query.
  """
  if not location or not query:
    return "Provide both location and query to search."
  hits = search_pois(location, [query], max_results=max_results)
  return _serialize_rows(hits)


def weather_lookup_tool(lat: Optional[float] = None, lon: Optional[float] = None, location: Optional[str] = None) -> str:
  """
  Retrieve weather forecast for a place. Provide either latitude & longitude
  or a location name (e.g. "Bengaluru, IN").
  """
  query_lat, query_lon = lat, lon

  if (query_lat is None or query_lon is None) and location:
    try:
      async def _geocode():
        geo_url = "https://api.openweathermap.org/geo/1.0/direct"
        params = {"q": location, "limit": 1, "appid": os.getenv("OPENWEATHER_API_KEY")}
        async with httpx.AsyncClient(timeout=15.0) as client:
          resp = await client.get(geo_url, params=params)
          resp.raise_for_status()
          return resp.json()

      geo_results = _run_async(_geocode())
      if geo_results:
        result = geo_results[0]
        query_lat = result.get("lat")
        query_lon = result.get("lon")
    except Exception:
      query_lat = query_lat or None
      query_lon = query_lon or None

  if query_lat is None or query_lon is None:
    return "Latitude and longitude (or a recognizable location name) are required."

  async def _fetch_openweather():
    return await get_weather_daily(query_lat, query_lon)

  async def _fetch_openmeteo():
    base = "https://api.open-meteo.com/v1/forecast"
    params = {
      "latitude": query_lat,
      "longitude": query_lon,
      "daily": "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode",
      "timezone": "auto"
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
      resp = await client.get(base, params=params)
      resp.raise_for_status()
      return resp.json()

  try:
    result = _run_async(_fetch_openweather())
    daily = result.get("daily", [])
    summary = []
    for day in daily[:5]:
      dt = datetime.fromtimestamp(day.get("dt")).date() if day.get("dt") else None
      summary.append({
        "date": dt.isoformat() if dt else None,
        "temp_min": day.get("temp", {}).get("min"),
        "temp_max": day.get("temp", {}).get("max"),
        "description": day.get("weather", [{}])[0].get("description")
      })
    return _serialize_rows(summary)
  except Exception as exc_open:
    try:
      result = _run_async(_fetch_openmeteo())
      daily = result.get("daily", {})
      times = daily.get("time", [])
      max_t = daily.get("temperature_2m_max", [])
      min_t = daily.get("temperature_2m_min", [])
      summary = []
      for idx, date_str in enumerate(times[:5]):
        summary.append({
          "date": date_str,
          "temp_min": min_t[idx] if idx < len(min_t) else None,
          "temp_max": max_t[idx] if idx < len(max_t) else None,
          "description": None
        })
      return _serialize_rows(summary)
    except Exception as exc_meta:
      return f"Weather lookup failed: {exc_open}; fallback also failed: {exc_meta}"


def generate_itinerary_tool(
  booking_json: str,
  preferences_json: Optional[str] = None,
  notes: Optional[str] = None
) -> str:
  """
  Build a day-by-day plan using the existing concierge planner.
  """
  booking_payload = json.loads(booking_json)
  prefs_payload = json.loads(preferences_json) if preferences_json else {}

  def _parse_date(value: Any) -> date:
    if isinstance(value, date):
      return value
    if isinstance(value, datetime):
      return value.date()
    return datetime.fromisoformat(str(value)).date()

  booking = BookingContext(
    booking_id=booking_payload.get("booking_id"),
    location=booking_payload.get("location"),
    lat=booking_payload.get("lat"),
    lon=booking_payload.get("lon"),
    start_date=_parse_date(booking_payload["start_date"]),
    end_date=_parse_date(booking_payload["end_date"]),
    party_type=booking_payload.get("party_type"),
    guests=booking_payload.get("guests"),
  )

  prefs = Preferences(**{**Preferences().dict(), **prefs_payload})
  ask = ConciergeAsk(
    booking=booking,
    prefs=prefs,
    free_text=notes or ""
  )

  async def _generate():
    return await generate_concierge(ask, weather_daily=None)

  response = _run_async(_generate())
  summary = []
  for day in response.plan:
    summary.append({
      "date": day.date.isoformat(),
      "morning": [card.title for card in day.morning],
      "afternoon": [card.title for card in day.afternoon],
      "evening": [card.title for card in day.evening]
    })

  return json.dumps({
    "plan": summary,
    "restaurants": [card.title for card in response.restaurants],
    "packing_checklist": response.packing_checklist
  }, ensure_ascii=False)
