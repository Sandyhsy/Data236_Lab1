import { useEffect, useMemo, useState } from "react";

function toKey(booking) {
  if (!booking) return "";
  return String(booking.booking_id ?? booking.id ?? "");
}

function formatBookingLabel(booking) {
  if (!booking) return "No booking selected";
  const parts = [];
  if (booking.property_name) parts.push(booking.property_name);
  const start = booking.start_date || booking.startDate;
  const end = booking.end_date || booking.endDate;
  if (start && end) {
    const startText = new Date(start).toLocaleDateString();
    const endText = new Date(end).toLocaleDateString();
    parts.push(`${startText} – ${endText}`);
  }
  if (parts.length === 0) {
    parts.push(`Booking #${booking.booking_id ?? booking.id}`);
  }
  return parts.join(" • ");
}

function splitLines(text) {
  return text.split(/\n+/).map((line, idx) => (
    <p key={idx} className="mb-1">
      {line}
    </p>
  ));
}

export default function ConciergeChat({
  user,
  bookings = [],
  booking: primaryBooking = null
}) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(toKey(primaryBooking));
  const [selectedBooking, setSelectedBooking] = useState(primaryBooking);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState(() => ([
    {
      role: "assistant",
      content: "Hi there! I'm your AI concierge. Tell me about your trip or ask for ideas anytime."
    }
  ]));

  useEffect(() => {
    if (!open) return;
    setInput("");
  }, [open]);

  useEffect(() => {
    if (primaryBooking) {
      const key = toKey(primaryBooking);
      setSelectedId(key);
      setSelectedBooking(primaryBooking);
      return;
    }
    if (bookings.length === 0) {
      setSelectedBooking(null);
      setSelectedId("");
      return;
    }
    const match = bookings.find(b => toKey(b) === selectedId);
    if (match) {
      setSelectedBooking(match);
    } else {
      const first = bookings[0];
      setSelectedBooking(first);
      setSelectedId(toKey(first));
    }
  }, [primaryBooking, bookings, selectedId]);

  const hasBooking = !!selectedBooking;
  const conversation = useMemo(() => messages, [messages]);

  const appendMessage = (msg) => {
    setMessages(prev => [...prev, msg]);
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    appendMessage({ role: "user", content: trimmed });
    setInput("");
    setPending(true);
    setError(null);

    const CONCIERGE_URL = (process.env.REACT_APP_CONCIERGE_URL || "http://localhost:8001") + "/ai/concierge/chat";
    try {
      const payload = {
        messages: [...conversation, { role: "user", content: trimmed }],
        context: {
          traveler: user,
          active_booking_id: selectedBooking?.booking_id ?? selectedBooking?.id ?? null,
          active_booking: selectedBooking,
          bookings
        }
      };

      const res = await fetch(CONCIERGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${res.status})`);
      }

      const body = await res.json();
      appendMessage({ role: "assistant", content: body.reply || "Thanks! Let me know if you need anything else." });
    } catch (err) {
      setError(err.message || "Unable to reach the concierge service.");
      appendMessage({
        role: "assistant",
        content: "I'm having trouble reaching the planning service right now. Please try again shortly."
      });
    } finally {
      setPending(false);
    }
  };

  const panelStyle = {
    position: "fixed",
    top: 0,
    right: 0,
    height: "100%",
    width: 420,
    maxWidth: "100vw",
    backgroundColor: "#fff",
    boxShadow: "0 0 30px rgba(0,0,0,0.2)",
    transform: open ? "translateX(0)" : "translateX(105%)",
    transition: "transform 0.3s ease-in-out",
    zIndex: 1050,
    display: "flex",
    flexDirection: "column"
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="btn btn-primary rounded-pill shadow-lg"
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 1040,
          padding: "12px 20px",
          fontWeight: 600
        }}
      >
        AI Concierge
      </button>

      <div style={panelStyle} aria-hidden={!open}>
        <div className="d-flex align-items-center justify-content-between border-bottom px-3 py-2">
          <div>
            <div className="fw-semibold">AI Concierge</div>
            {hasBooking ? (
              <small className="text-muted">{formatBookingLabel(selectedBooking)}</small>
            ) : (
              <small className="text-muted">
                No trips yet. Ask me anything to start planning once you book.
              </small>
            )}
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={() => setOpen(false)}
            aria-label="Close"
          />
        </div>

        <div className="px-3 py-2 border-bottom">
          <label className="form-label text-muted small mb-1">Choose a trip</label>
          <select
            className="form-select form-select-sm"
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              const next = bookings.find(b => toKey(b) === e.target.value);
              setSelectedBooking(next || null);
            }}
          >
            {bookings.length === 0 && (
              <option value="">No bookings yet</option>
            )}
            {bookings.map((b, idx) => {
              const key = toKey(b) || `booking-${idx}`;
              return (
                <option key={key} value={key}>
                  {formatBookingLabel(b)}
                </option>
              );
            })}
          </select>
        </div>

        <div className="flex-grow-1 overflow-auto px-3 py-2" style={{ backgroundColor: "#f8f9fa" }}>
          <div className="d-flex flex-column gap-2">
            {conversation.map((msg, idx) => (
              <div
                key={idx}
                className={`p-2 rounded ${msg.role === "user" ? "bg-primary text-white align-self-end" : "bg-white border align-self-start"}`}
                style={{ maxWidth: "85%" }}
              >
                {splitLines(msg.content)}
              </div>
            ))}
            {pending && (
              <div className="bg-white border rounded p-2 align-self-start text-muted small">
                Thinking…
              </div>
            )}
          </div>
        </div>

        <div className="px-3 py-2 border-top">
          {error && (
            <div className="alert alert-danger py-2 px-3 mb-2 small">
              {error}
            </div>
          )}
          <textarea
            className="form-control mb-2"
            rows={2}
            placeholder={hasBooking ? "Ask for recommendations, itineraries, or tips…" : "Ask about travel ideas. I'll tailor more once you have a booking."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={pending}
          />
          <div className="d-flex justify-content-between align-items-center">
            <small className="text-muted">
              Tip: mention dietary needs or mobility preferences for tailored plans.
            </small>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSend}
              disabled={pending || !input.trim()}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
