AI Concierge Agent

This folder contains a FastAPI-based AI concierge agent that uses Google's Gemini via the `google-generativeai` Python SDK.

Notes
 - The agent will attempt to use Gemini if `GEMINI_API_KEY` is provided and the `google.generativeai` package is installed.
 Model note: the agent defaults to the Gemini 2f Flash model (`gemini-2f-flash`). Change the `MODEL_NAME` constant in `agentic/agent/providers/llm.py` if you want another variant (for example `gemini-2.5-flash`).
 - The endpoint is `POST /ai/concierge` (accepts the ConciergeAsk schema defined in `agentic/agent/models.py`).

Notes
- The agent will attempt to use Gemini if `GEMINI_API_KEY` is provided and the `google.generativeai` package is installed.
- The endpoint is `POST /ai/concierge` (accepts the ConciergeAsk schema defined in `agentic/agent/models.py`).
Additionally, a chat-friendly endpoint is available at `POST /ai/chat` which accepts a `booking` dict and a `message` string and returns a `reply` plus the structured `concierge` plan when applicable.
The agent now exposes two helper endpoints:

- `GET /ai/health` — returns the configured model and whether key env vars (GEMINI_API_KEY, TAVILY_API_KEY, OPENWEATHER_API_KEY) are present.
- `GET /ai/history?booking_id=<id>` — returns chat history stored for a booking (if a DB is configured).

Chat persistence: messages are stored in a lightweight `chat_history` table (created automatically when a SQL database is configured via `DATABASE_URL`). If no DB is configured the agent will operate statelessly but still return plans.
