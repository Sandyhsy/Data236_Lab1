# agent/providers/weather.py
import os, httpx

OWM_KEY = os.getenv("OPENWEATHER_API_KEY")

async def get_weather_daily(lat:float, lon:float):
    """Daily weather (7–8 days) for packing + time-of-day planning."""
    # One Call 2.5 (free tier)
    url = "https://api.openweathermap.org/data/2.5/onecall"
    params = {
        "lat": lat, "lon": lon,
        "exclude": "minutely,hourly,alerts",
        "units": "metric",
        "appid": OWM_KEY
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        return r.json()
