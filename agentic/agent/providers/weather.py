# agent/providers/weather.py
from __future__ import annotations

import os
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import httpx
from dotenv import load_dotenv

load_dotenv()


def _weathercode_description(code: Optional[int]) -> str:
    mapping = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Foggy",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        56: "Light freezing drizzle",
        57: "Dense freezing drizzle",
        61: "Light rain",
        63: "Moderate rain",
        65: "Heavy rain",
        66: "Light freezing rain",
        67: "Heavy freezing rain",
        71: "Light snow",
        73: "Moderate snow",
        75: "Heavy snow",
        77: "Snow grains",
        80: "Light rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        85: "Light snow showers",
        86: "Heavy snow showers",
        95: "Thunderstorm",
        96: "Thunderstorm with hail",
        99: "Thunderstorm with heavy hail",
    }
    if code is None:
        return "Unknown conditions"
    return mapping.get(int(code), "Mixed weather")


async def geocode_location(location: str) -> Optional[Tuple[float, float]]:
    """
    Resolve a textual location to latitude/longitude using OpenWeather when
    available and falling back to Open-Meteo's geocoding API otherwise.
    """
    if not location:
        return None

    ow_key = os.getenv("OPENWEATHER_API_KEY")
    if ow_key:
        url = "https://api.openweathermap.org/geo/1.0/direct"
        params = {"q": location, "limit": 1, "appid": ow_key}
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()
            except Exception:
                data = None
        if data:
            first = data[0]
            lat = first.get("lat")
            lon = first.get("lon")
            if lat is not None and lon is not None:
                try:
                    return float(lat), float(lon)
                except (TypeError, ValueError):
                    pass

    # Fallback: Open-Meteo geocoding (no API key required)
    url = "https://geocoding-api.open-meteo.com/v1/search"
    params = {"name": location, "count": 1, "language": "en", "format": "json"}
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
        except Exception:
            return None

    results = data.get("results") if isinstance(data, dict) else None
    if not results:
        return None
    primary = results[0]
    lat = primary.get("latitude")
    lon = primary.get("longitude")
    if lat is None or lon is None:
        return None
    try:
        return float(lat), float(lon)
    except (TypeError, ValueError):
        return None


async def _fetch_openweather(lat: float, lon: float, key: str) -> Dict:
    url = "https://api.openweathermap.org/data/2.5/onecall"
    params = {
        "lat": lat,
        "lon": lon,
        "exclude": "minutely,hourly,alerts",
        "units": "metric",
        "appid": key,
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        payload = resp.json()
    if isinstance(payload, dict):
        payload.setdefault("source", "openweather")
    return payload


async def _fetch_openmeteo(lat: float, lon: float) -> Dict:
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode",
        "timezone": "UTC",
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        raw = resp.json()

    daily = raw.get("daily") or {}
    times: List[str] = daily.get("time") or []
    max_t = daily.get("temperature_2m_max") or []
    min_t = daily.get("temperature_2m_min") or []
    precip = daily.get("precipitation_probability_max") or []
    codes = daily.get("weathercode") or []

    converted = []
    for idx, date_str in enumerate(times):
        try:
            ts = int(datetime.fromisoformat(date_str).timestamp())
        except Exception:
            ts = None
        max_val = max_t[idx] if idx < len(max_t) else None
        min_val = min_t[idx] if idx < len(min_t) else None
        code = codes[idx] if idx < len(codes) else None
        precip_val = precip[idx] if idx < len(precip) else None
        converted.append(
            {
                "dt": ts,
                "temp": {"max": max_val, "min": min_val},
                "weather": [{"description": _weathercode_description(code), "id": code}],
                "pop": (precip_val / 100.0) if isinstance(precip_val, (int, float)) else None,
            }
        )

    return {"daily": converted, "source": "open-meteo"}


async def get_weather_daily(lat: float, lon: float) -> Dict:
    """
    Return a normalized weather payload containing a `daily` list.
    Tries OpenWeather when an API key is configured; falls back to
    Open-Meteo otherwise.
    """
    key = os.getenv("OPENWEATHER_API_KEY")
    if key:
        try:
            return await _fetch_openweather(lat, lon, key)
        except Exception:
            pass  # fall through to Open-Meteo
    # fallback to Open-Meteo (no key required)
    return await _fetch_openmeteo(lat, lon)
