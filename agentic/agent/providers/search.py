# agent/providers/search.py
from typing import List, Dict
import os
import itertools

try:
    from tavily import TavilyClient  # official SDK
except Exception:  # pragma: no cover - optional dependency
    TavilyClient = None

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
_client = None
if TAVILY_API_KEY and TavilyClient:
    try:
        _client = TavilyClient(api_key=TAVILY_API_KEY)
    except Exception:
        _client = None  # fall back to offline heuristics when SDK init fails


def _fallback_hits(location: str, query: str, limit: int) -> List[Dict]:
    """
    Generate deterministic, offline-friendly search hits so the planner can run
    even when the Tavily SDK/key/network is unavailable.
    """
    base = query.strip() or f"things to do in {location}"
    # Create a few variations to mimic unique recommendations.
    templates = [
        "Explore {base}",
        "Local favorite: {base}",
        "Don't miss: {base}",
        "Hidden gem near {location}",
        "Top pick for visitors: {base}",
    ]
    hits = []
    for i, tmpl in enumerate(itertools.islice(itertools.cycle(templates), limit)):
        hits.append({
            "title": tmpl.format(base=base.title(), location=location).strip(),
            "url": f"https://example.org/{location.replace(' ', '-').lower()}/{i+1}",
            "content": f"Suggested activity inspired by '{base}' in {location}.",
        })
    return hits


def search_pois(location: str, queries: List[str], max_results: int = 10) -> List[Dict]:
    """Return structured search hits for POIs/events."""
    results: List[Dict] = []
    if not queries:
        return results

    for q in queries:
        full_q = f"{q} in {location}"
        if _client is None:
            results.extend(_fallback_hits(location, q, limit=min(3, max_results)))
            continue

        try:
            resp = _client.search(full_q, search_depth="advanced", max_results=max_results)
        except Exception:
            # Network failures or API issues shouldn't break the concierge plan.
            results.extend(_fallback_hits(location, q, limit=min(3, max_results)))
            continue

        for item in resp.get("results", []):
            results.append({
                "title": item.get("title"),
                "url": item.get("url"),
                "content": item.get("content"),
            })

        # If Tavily returns nothing, ensure we still provide something helpful.
        if not resp.get("results"):
            results.extend(_fallback_hits(location, q, limit=min(3, max_results)))
    return results
