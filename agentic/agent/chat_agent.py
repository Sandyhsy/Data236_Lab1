import json
import os
from functools import lru_cache
from typing import Any, Dict, List

from langchain.agents import create_agent
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.tools import StructuredTool
from langchain_google_genai import ChatGoogleGenerativeAI

from .tools import (
    favorites_lookup_tool,
    generate_itinerary_tool,
    lookup_booking_tool,
    tavily_search_tool,
    weather_lookup_tool,
)


@lru_cache(maxsize=1)
def _build_agent():
    tools = [
        StructuredTool.from_function(
            lookup_booking_tool,
            name="lookup_booking",
            description="Look up booking details by booking_id or traveler_id to understand trip context."
        ),
        StructuredTool.from_function(
            favorites_lookup_tool,
            name="list_favorites",
            description="Fetch traveler favorite properties using traveler_id to personalize suggestions."
        ),
        StructuredTool.from_function(
            tavily_search_tool,
            name="search_pois",
            description="Search for local points of interest, events, or activities. Requires location and query."
        ),
        StructuredTool.from_function(
            weather_lookup_tool,
            name="get_weather",
            description="Retrieve weather forecast for latitude/longitude to advise on packing."
        ),
        StructuredTool.from_function(
            generate_itinerary_tool,
            name="generate_itinerary",
            description="Create a day-by-day itinerary using booking and preference JSON payloads."
        ),
    ]

    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        temperature=0.4,
        google_api_key=os.getenv("GEMINI_API_KEY"),
        convert_system_message_to_human=False,
    )

    system_prompt = (
        "You are an AI travel concierge helping Airbnb travelers. "
        "Use the provided tools to ground your answers with real data. "
        "Always incorporate booking context, traveler preferences, favorites, weather, "
        "and web search findings when helpful. "
        "Respond with friendly, concise messages. "
        "If you deliver an itinerary, format it with clear headings per day."
        "\nContext JSON: {context}"
    )

    return create_agent(
        model=llm,
        tools=tools,
        system_prompt=system_prompt,
    )


def _message_text(message: AIMessage) -> str:
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

    agent = _build_agent()

    context_str = json.dumps(context or {}, default=str)

    conversation = [SystemMessage(content=f"Context JSON: {context_str}")]
    for msg in messages:
        if msg.get("role") == "user":
            conversation.append(HumanMessage(content=msg.get("content", "")))
        else:
            conversation.append(AIMessage(content=msg.get("content", "")))

    inputs = {
        "messages": conversation,
        "context": context_str
    }

    result = await agent.ainvoke(inputs)
    # The agent returns a dict with "messages"
    for message in reversed(result.get("messages", [])):
        if isinstance(message, AIMessage):
            text = _message_text(message)
            if text:
                return text

    return "Glad to help!"
