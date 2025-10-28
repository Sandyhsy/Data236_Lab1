import json
import os
from typing import Any, Dict, List, Optional

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI

_llm: Optional[ChatGoogleGenerativeAI] = None


def _get_llm() -> Optional[ChatGoogleGenerativeAI]:
    """Create (and cache) the Gemini chat model if the key is present."""
    global _llm
    if _llm is not None:
        return _llm

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None

    try:
        _llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            temperature=0.4,
            google_api_key=api_key,
            convert_system_message_to_human=False,
        )
    except Exception:
        _llm = None
    return _llm


def _message_text(message: BaseMessage) -> str:
    content = message.content
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                parts.append(item.get("text") or "")
            else:
                parts.append(getattr(item, "text", str(item)))
        return "\n".join(part for part in parts if part)
    return str(content)


async def run_concierge_chat(messages: List[Dict[str, Any]], context: Dict[str, Any]) -> str:
    if not messages:
        return "Hello! Tell me about your upcoming trip and I can help plan it."

    context_str = json.dumps(context or {}, default=str)
    base_prompt = (
        "You are an AI travel concierge helping Airbnb guests. "
        "Blend warm hospitality with concrete suggestions. "
        "Always leverage any booking details, traveler preferences, weather, favorite properties, "
        "and search highlights present in the provided context JSON. "
        "If you propose an itinerary, break it into clear sections (Day 1, Morning/Afternoon/Evening, etc.). "
        "Offer practical packing or local tips when relevant.\n"
        f"Context JSON: {context_str}"
    )

    conversation: List[BaseMessage] = [SystemMessage(content=base_prompt)]
    for msg in messages:
        text = msg.get("content") or ""
        if not text:
            continue
        if msg.get("role") == "user":
            conversation.append(HumanMessage(content=text))
        else:
            conversation.append(AIMessage(content=text))

    llm = _get_llm()
    if llm is None:
        return (
            "I'm ready to help plan your trip once a Gemini API key is configured. "
            "In the meantime, you can use the standard concierge plan generator."
        )

    try:
        result = await llm.ainvoke(conversation)
    except AttributeError:
        try:
            result = llm.invoke(conversation)
        except Exception:
            return (
                "I couldn't reach the language model just now, but you can still generate a plan "
                "from the main concierge button and try again shortly."
            )
    except Exception:
        return (
            "I couldn't reach the language model just now, but you can still generate a plan "
            "from the main concierge button and try again shortly."
        )

    if isinstance(result, BaseMessage):
        return _message_text(result)
    if isinstance(result, dict) and "content" in result:
        return result["content"]
    return str(result)
