# agent/planner.py
from datetime import datetime, timedelta, date as dt_date
from typing import List, Dict, Any
from .models import ConciergeAsk, ConciergeResponse, DayPlan, ActivityCard
from .providers.search import search_pois
from .providers.llm import generate_plan_with_gemini

# --- very light NLU (augment with LLM later if you want) ---
def parse_free_text(free:str) -> Dict:
    if not free: return {}
    ft = free.lower()
    prefs = {}
    if "vegan" in ft: prefs["dietary"] = "vegan"
    if "vegetarian" in ft and "vegan" not in ft: prefs["dietary"] = "vegetarian"
    if "gluten" in ft: prefs["dietary"] = "gluten_free"
    if "no long hikes" in ft or "no hiking" in ft or "limited walk" in ft:
        prefs["mobility_needs"] = "limited_walk"
    if "wheelchair" in ft: prefs["mobility_needs"] = "wheelchair"
    if "kids" in ft or "children" in ft or "family" in ft:
        prefs["child_friendly"] = True
    # interests quick picks
    interests = []
    for k in ["museums","hikes","beach","nightlife","shopping","parks","zoos","aquariums","art","history","food tours"]:
        if k in ft: interests.append(k)
    if interests: prefs["interests"] = interests
    return prefs

# --- heuristics to flag accessibility/kid-friendly from snippets ---
def infer_flags(text:str):
    t = text.lower() if text else ""
    return {
        "wheelchair_friendly": any(w in t for w in ["wheelchair accessible","step-free","accessible entrance"]),
        "child_friendly": any(w in t for w in ["kids","family-friendly","children"]),
    }

def price_tier_from_text(text:str):
    if not text: return None
    t = text.lower()
    if "$$$" in t or "expensive" in t: return "$$$"
    if "$$" in t or "moderate" in t: return "$$"
    if "$" in t or "cheap" in t or "budget" in t: return "$"
    return None

def plan_days(start, end) -> List:
    days = []
    cur = start
    while cur <= end:
        days.append(cur)
        cur += timedelta(days=1)
    return days

def build_queries(location:str, prefs:Dict, day:str, timeblock:str, dietary:str|None):
    q = []
    # time-of-day flavor
    if timeblock == "morning":
        q.append(f"best morning activities {location}")
    elif timeblock == "afternoon":
        q.append(f"top attractions {location}")
    else:
        q.append(f"evening things to do {location}")
        q.append(f"events tonight {location}")
    # interests
    for i in prefs.get("interests", []):
        q.append(f"{i} {location}")
    # restaurants
    if dietary and timeblock in ("afternoon","evening"):
        q.append(f"{dietary} restaurants {location}")
    return q[:6]  # cap

def make_activity_cards(hits:List[Dict], limit:int=3) -> List[ActivityCard]:
    out = []
    seen = set()
    for h in hits:
        title = (h.get("title") or "").strip()
        if not title or title in seen: continue
        seen.add(title)
        flags = infer_flags(h.get("content"))
        out.append(ActivityCard(
            title=title[:120],
            url=h.get("url"),
            price_tier=price_tier_from_text(h.get("content")),
            duration_min=None,
            tags=[],
            wheelchair_friendly=flags["wheelchair_friendly"],
            child_friendly=flags["child_friendly"]
        ))
        if len(out) >= limit: break
    return out

async def generate_concierge(ask:ConciergeAsk, weather_daily:Dict|None=None) -> ConciergeResponse:
    b = ask.booking
    # merge explicit prefs + NLU from free_text
    p = ask.prefs.dict() if ask.prefs else {}
    p.update(parse_free_text(ask.free_text))
    dietary = p.get("dietary","none")
    location = b.location

    # weather-aware packing and forecast context
    packing = []
    weather_forecast: List[Dict[str, Any]] = []
    weather_summary_text = None
    if weather_daily:
        daily_list = weather_daily.get("daily") or []
        if daily_list:
            # capture up to 5-day forecast summary for downstream prompts
            for entry in daily_list[:5]:
                ts = entry.get("dt")
                date_str = datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d") if ts else None
                temps = entry.get("temp") or {}
                weather_forecast.append({
                    "date": date_str,
                    "description": (entry.get("weather") or [{}])[0].get("description"),
                    "temp_min_c": temps.get("min"),
                    "temp_max_c": temps.get("max"),
                    "precip_probability": entry.get("pop"),
                })

            if weather_forecast:
                pieces = []
                for entry in weather_forecast[:3]:
                    date_str = entry.get("date") or "Unknown date"
                    desc = entry.get("description") or "Unknown conditions"
                    maxc = entry.get("temp_max_c")
                    minc = entry.get("temp_min_c")
                    part = f"{date_str}: {desc}"
                    temp_bit = []
                    if maxc is not None:
                        temp_bit.append(f"high {round(float(maxc),1)}°C")
                    if minc is not None:
                        temp_bit.append(f"low {round(float(minc),1)}°C")
                    if temp_bit:
                        part += f" ({' / '.join(temp_bit)})"
                    pieces.append(part)
                if pieces:
                    weather_summary_text = "; ".join(pieces)

            day0 = daily_list[0]
            maxc = (day0.get("temp") or {}).get("max")
            minc = (day0.get("temp") or {}).get("min")
            if maxc is not None and maxc >= 28:
                packing += ["sunscreen","hat","light clothing","reusable water bottle"]
            if minc is not None and minc <= 10:
                packing += ["warm jacket","layers","beanie"]
            if any((w or {}).get("id", 0)//100 in (2,3,5) for w in (day0.get("weather") or [])):  # rain groups
                packing += ["rain jacket","compact umbrella","waterproof shoes"]
    packing = list(dict.fromkeys(packing)) or ["comfortable shoes","daypack","charger"]

    # build day-by-day suggestions
    days = plan_days(b.start_date, b.end_date)
    dayplans = []
    day_suggestions: List[Dict[str, Any]] = []
    for d in days:
        # morning / afternoon / evening
        blocks = {"morning":[],"afternoon":[],"evening":[]}
        suggestion_entry = {"date": str(d), "blocks": {}}
        for block in blocks.keys():
            qs = build_queries(location, p, str(d), block, None if dietary=="none" else dietary)
            hits = search_pois(location, qs, max_results=6)
            blocks[block] = make_activity_cards(hits, limit=3)
            suggestion_entry["blocks"][block] = [
                {
                    "title": card.title,
                    "url": card.url,
                    "price_tier": card.price_tier,
                    "tags": card.tags,
                    "wheelchair_friendly": card.wheelchair_friendly,
                    "child_friendly": card.child_friendly
                }
                for card in blocks[block]
            ]
        dayplans.append(DayPlan(date=d, **blocks))
        day_suggestions.append(suggestion_entry)

    # restaurants: run explicit dietary search
    restaurants_hits = search_pois(location, [
        f"{dietary} restaurants {location}" if dietary!="none" else f"best restaurants {location}",
        f"family friendly restaurants {location}" if p.get("child_friendly") else f"popular eateries {location}"
    ], max_results=12)
    restaurants = make_activity_cards(restaurants_hits, limit=6)
    restaurant_suggestions = [
        {
            "title": card.title,
            "url": card.url,
            "price_tier": card.price_tier,
            "tags": card.tags,
            "wheelchair_friendly": card.wheelchair_friendly,
            "child_friendly": card.child_friendly
        }
        for card in restaurants
    ]

    notes = [
        f"Preferences used: dietary={dietary}, mobility={p.get('mobility_needs','none')}, budget={p.get('budget','mid')}",
        "Source: Tavily web search results (titles/snippets normalized).",
        "Gemini assistance unavailable; returning heuristic itinerary."
    ]
    if weather_summary_text:
        notes.append("Weather outlook: " + weather_summary_text)

    base_response = ConciergeResponse(
        plan=dayplans,
        restaurants=restaurants,
        packing_checklist=packing,
        reasoning_notes=notes
    )

    # Attempt Gemini-enhanced plan
    payload = {
        "booking": {
            "location": location,
            "start_date": str(b.start_date),
            "end_date": str(b.end_date),
            "guests": b.guests,
            "party_type": b.party_type
        },
        "preferences": p,
        "weather": None,
        "weather_forecast": weather_forecast,
        "day_suggestions": day_suggestions,
        "restaurant_suggestions": restaurant_suggestions,
        "default_packing": packing,
        "weather_overview": weather_summary_text,
    }

    if weather_daily:
        today = weather_daily.get("daily", [{}])[0] if isinstance(weather_daily.get("daily"), list) else {}
        payload["weather"] = {
            "summary": today.get("weather", [{}])[0].get("description") if today.get("weather") else None,
            "temp_min_c": today.get("temp", {}).get("min"),
            "temp_max_c": today.get("temp", {}).get("max"),
            "precip_probability": today.get("pop"),
        }
        if weather_forecast:
            payload["weather"]["forecast"] = weather_forecast

    llm_result = await generate_plan_with_gemini(payload)
    if not llm_result:
        return base_response

    try:
        plan_entries = []
        for day_entry in llm_result.get("plan", []):
            date_str = day_entry.get("date")
            if not date_str:
                continue
            try:
                day_date = dt_date.fromisoformat(date_str)
            except ValueError:
                continue

            def parse_cards(cards):
                parsed = []
                for c in cards or []:
                    title = (c.get("title") or "").strip()
                    if not title:
                        continue
                    parsed.append(ActivityCard(
                        title=title[:120],
                        url=c.get("url"),
                        price_tier=c.get("price_tier"),
                        duration_min=c.get("duration_min"),
                        tags=list(c.get("tags") or []),
                        wheelchair_friendly=c.get("wheelchair_friendly"),
                        child_friendly=c.get("child_friendly")
                    ))
                return parsed

            plan_entries.append(DayPlan(
                date=day_date,
                morning=parse_cards(day_entry.get("morning")),
                afternoon=parse_cards(day_entry.get("afternoon")),
                evening=parse_cards(day_entry.get("evening"))
            ))

        restaurants_llm = []
        for item in llm_result.get("restaurants", []):
            title = (item.get("title") or "").strip()
            if not title:
                continue
            restaurants_llm.append(ActivityCard(
                title=title[:120],
                url=item.get("url"),
                price_tier=item.get("price_tier"),
                duration_min=item.get("duration_min"),
                tags=list(item.get("tags") or []),
                wheelchair_friendly=item.get("wheelchair_friendly"),
                child_friendly=item.get("child_friendly")
            ))

        packing_llm = llm_result.get("packing_checklist")
        if not isinstance(packing_llm, list) or not packing_llm:
            packing_llm = packing

        reasoning = llm_result.get("reasoning_notes")
        if not isinstance(reasoning, list) or not reasoning:
            reasoning = [
                "Gemini 2.5 Flash generated this itinerary using your inputs.",
            ]

        return ConciergeResponse(
            plan=plan_entries or dayplans,
            restaurants=restaurants_llm or restaurants,
            packing_checklist=[str(item) for item in packing_llm],
            reasoning_notes=[str(note) for note in reasoning]
        )
    except Exception:
        # Fallback to heuristic output if parsing fails
        return base_response
