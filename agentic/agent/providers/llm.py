import asyncio
import json
import os
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

load_dotenv()

try:
    import google.generativeai as genai
except ImportError:  # pragma: no cover - dependency optional at runtime
    genai = None

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = "gemini-2.5-flash"

_model = None
_model_error: Optional[Exception] = None

if GEMINI_API_KEY and genai is not None:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        _model = genai.GenerativeModel(MODEL_NAME)
    except Exception as exc:  # pragma: no cover - diagnostics only
        _model_error = exc
        _model = None


async def generate_plan_with_gemini(payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Ask Gemini to craft a concierge plan matching our JSON schema.
    Returns None on failure so callers can gracefully fall back.
    """
    if _model is None:
        return None

    prompt = (
        "You are an enthusiastic travel concierge crafting detailed itineraries.\n"
        "Using the structured JSON context provided below, create a plan that matches this JSON schema:\n"
        "{\n"
        "  \"plan\": [\n"
        "    {\n"
        "      \"date\": \"YYYY-MM-DD\",\n"
        "      \"morning\": [ActivityCard],\n"
        "      \"afternoon\": [ActivityCard],\n"
        "      \"evening\": [ActivityCard]\n"
        "    }\n"
        "  ],\n"
        "  \"restaurants\": [ActivityCard],\n"
        "  \"packing_checklist\": [\"item\", ...],\n"
        "  \"reasoning_notes\": [\"note\", ...]\n"
        "}\n\n"
        "ActivityCard object shape:\n"
        "{\n"
        "  \"title\": string,\n"
        "  \"url\": string|null,\n"
        "  \"price_tier\": \"$\"|\"$$\"|\"$$$\"|null,\n"
        "  \"duration_min\": integer|null,\n"
        "  \"tags\": [string,...],\n"
        "  \"wheelchair_friendly\": boolean|null,\n"
        "  \"child_friendly\": boolean|null\n"
        "}\n\n"
        "Rules:\n"
        "- Respect traveler preferences and any flags in the context.\n"
        "- Prefer provided activity suggestions, but you may add light variations if helpful.\n"
        "- Return ONLY valid JSON matching the schema. No prose.\n"
    )

    context_json = json.dumps(payload, ensure_ascii=False)
    request_parts: List[Any] = [
        {"role": "system", "parts": [prompt]},
        {
            "role": "user",
            "parts": [
                "Context JSON:\n",
                context_json,
                "\nProduce the plan JSON now."
            ],
        },
    ]

    generation_config = {
        "response_mime_type": "application/json",
        "temperature": 0.7,
    }

    def _invoke():
        return _model.generate_content(
            request_parts,
            generation_config=generation_config,
        )

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    try:
        response = await loop.run_in_executor(None, _invoke)
    except Exception:  # pragma: no cover - runtime failure
        return None

    # Extract raw text safely across SDK versions
    raw_text: Optional[str] = None
    if response is None:
        return None
    if hasattr(response, "text"):
        raw_text = response.text
    elif getattr(response, "candidates", None):
        for candidate in response.candidates:
            for part in getattr(candidate, "content", {}).parts:
                if getattr(part, "text", None):
                    raw_text = part.text
                    break
            if raw_text:
                break

    if not raw_text:
        return None

    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        return None
