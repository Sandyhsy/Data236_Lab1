import { useEffect, useMemo, useState, useRef } from "react";

const rawConcierge = (process.env.REACT_APP_CONCIERGE_URL || "/api/ai").replace(/\/$/, "");
const conciergeBase = rawConcierge.endsWith("/ai") ? rawConcierge : `${rawConcierge}/ai`;

function toKey(booking) {
  if (!booking) return "";
  return String(booking.booking_id ?? booking.id ?? "");
}

function formatLabel(booking) {
  if (!booking) return "Unknown booking";
  const labelParts = [];
  if (booking.property_name) labelParts.push(booking.property_name);
  const start = booking.start_date || booking.startDate;
  const end = booking.end_date || booking.endDate;
  if (start && end) {
    labelParts.push(`${new Date(start).toLocaleDateString()} - ${new Date(end).toLocaleDateString()}`);
  }
  if (labelParts.length === 0 && (booking.booking_id || booking.id)) {
    labelParts.push(`Booking #${booking.booking_id ?? booking.id}`);
  }
  return labelParts.join(" • ");
}

export default function ConciergeButton({ booking, bookings = [] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [notes, setNotes] = useState("");
  const [messages, setMessages] = useState([]); // {role: 'user'|'assistant', text: string}
  const [chatInput, setChatInput] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [typing, setTyping] = useState(false);
  const messagesRef = useRef(null);
  const [selectedId, setSelectedId] = useState("");
  const [selectedBooking, setSelectedBooking] = useState(null);

  useEffect(() => {
    if (booking) {
      const key = toKey(booking);
      if (key !== selectedId) {
        setSelectedId(key);
      }
      setSelectedBooking(booking);
      return;
    }

    if (bookings.length === 0) {
      setSelectedBooking(null);
      setSelectedId("");
      return;
    }

    const existing = bookings.find(b => toKey(b) === selectedId);
    if (existing) {
      setSelectedBooking(existing);
      return;
    }

    const first = bookings[0];
    setSelectedBooking(first);
    setSelectedId(toKey(first));
  }, [booking, bookings, selectedId]);

  // Load chat history when panel opens for a booking
  useEffect(() => {
    const active = selectedBooking ?? booking ?? null;
    if (!open || !active || !active.booking_id) return;
    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        const HISTORY_URL = `${conciergeBase}/history?booking_id=${active.booking_id}`;
        const res = await fetch(HISTORY_URL);
        if (res.ok) {
          const body = await res.json();
          if (body.history) {
            // adapt rows -> messages
            setMessages(body.history.map(h => ({ role: h.role, text: h.message })));
            // scroll to bottom after loading
            setTimeout(() => {
              if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
            }, 50);
          }
        }
      } catch (e) {
        // ignore
      } finally {
        setLoadingHistory(false);
      }
    };
    loadHistory();
  }, [open, selectedBooking, booking]);

  const hasBooking = !!selectedBooking;

  const displayPlan = useMemo(() => {
    if (!data?.plan) return [];
    return data.plan;
  }, [data]);

  const togglePanel = () => {
    setOpen(prev => {
      const next = !prev;
      if (next) {
        setError(null);
      }
      return next;
    });
  };

  

  const sendChat = async (text) => {
    const active = selectedBooking ?? booking ?? null;
    if (!active) {
      setError("No booking available. Book a trip to use the concierge.");
      return;
    }
    const payloadBooking = {
      booking_id: active.booking_id ?? active.id ?? null,
      location: active.location ?? null,
      lat: active.lat ?? null,
      lon: active.lon ?? null,
      start_date: active.start_date ?? active.startDate ?? null,
      end_date: active.end_date ?? active.endDate ?? null,
      party_type: active.party_type ?? active.partyType ?? null,
      guests: active.guests ?? null
    };

    const CHAT_URL = `${conciergeBase}/chat`;
    setLoading(true);
    setTyping(true);
    setMessages(prev => [...prev, { role: "user", text }] );
    try {
      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking: payloadBooking, message: text })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${res.status})`);
      }
      const body = await res.json();
      if (body.reply) {
        setMessages(prev => [...prev, { role: "assistant", text: body.reply }]);
      }
      if (body.concierge) setData(body.concierge);
      // auto-scroll to bottom
      setTimeout(() => {
        if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
      }, 50);
      setChatInput("");
    } catch (err) {
      setError(err.message || "Chat failed");
    } finally {
      setLoading(false);
      setTyping(false);
    }
  };

  const panelStyle = {
    position: "fixed",
    top: 0,
    right: 0,
    height: "100%",
    width: 420,
    maxWidth: "90vw",
    backgroundColor: "#fff",
    boxShadow: "0 0 30px rgba(0,0,0,0.2)",
    transform: open ? "translateX(0)" : "translateX(100%)",
    transition: "transform 0.3s ease-in-out",
    zIndex: 1050,
    display: "flex",
    flexDirection: "column"
  };

  const panelHeaderStyle = {
    padding: "1rem",
    borderBottom: "1px solid #e5e5e5",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  };

  const panelBodyStyle = {
    padding: "1rem",
    overflowY: "auto",
    flex: 1
  };

  return (
    <>
      <button
        type="button"
        onClick={togglePanel}
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
        <div style={panelHeaderStyle}>
        <h5 className="mb-0">Your Trip Plan {loading || loadingHistory ? <span className="spinner-border spinner-border-sm ms-2" role="status" aria-hidden="true"></span> : null}</h5>
          <button
            type="button"
            className="btn-close"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
        </div>
        <div style={panelBodyStyle}>
          {!hasBooking && (
            <p className="text-muted small">
              You do not have any trips yet. Once you have a booking, use the AI Concierge to plan your stay.
            </p>
          )}

          {hasBooking && (
            <div className="mb-3">
              {bookings.length > 1 && (
                <div className="mb-3">
                  <label className="form-label fw-semibold small">Choose a trip</label>
                  <select
                    className="form-select form-select-sm"
                    value={selectedId}
                    onChange={(e) => {
                      const next = bookings.find(b => toKey(b) === e.target.value);
                      setSelectedId(e.target.value);
                      setSelectedBooking(next || null);
                      setData(null);
                      setError(null);
                    }}
                  >
                    {bookings.map((b, idx) => {
                      const key = toKey(b) || `booking-${idx}`;
                      return (
                        <option key={key} value={key}>
                          {formatLabel(b)}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {selectedBooking && (
                <div className="mb-3 small text-muted">
                  <div>Booking #{selectedBooking.booking_id ?? selectedBooking.id}</div>
                  {selectedBooking.property_name && <div>{selectedBooking.property_name}</div>}
                  <div>
                    {new Date(selectedBooking.start_date ?? selectedBooking.startDate).toLocaleDateString()} -{" "}
                    {new Date(selectedBooking.end_date ?? selectedBooking.endDate).toLocaleDateString()}
                  </div>
                  {selectedBooking.guests && <div>{selectedBooking.guests} guest(s)</div>}
                </div>
              )}

              <div className="mb-3">
                <label className="form-label fw-semibold small">Anything else we should know?</label>
                <div className="mb-2">
                  <div ref={messagesRef} className="chat-window border rounded p-2 mb-2 concierge-messages" style={{ maxHeight: 220, background: '#f8f9fa' }}>
                    {messages.length === 0 && !loadingHistory && <div className="text-muted small">No messages yet. Ask the concierge a question or generate a plan.</div>}
                    {loadingHistory && (
                      <div className="text-center text-muted small">Loading conversation…</div>
                    )}
                    {messages.map((m, idx) => (
                      <div key={`msg-${idx}`} className="concierge-row">
                        {m.role === 'assistant' && <img className="concierge-avatar" src="https://placehold.co/32x32?text=AI" alt="AI" />}
                        <div className={`concierge-bubble ${m.role === 'user' ? 'user' : 'assistant'}`}>{m.text}</div>
                        {m.role === 'user' && <img className="concierge-avatar" src="https://placehold.co/32x32?text=U" alt="You" />}
                      </div>
                    ))}
                    {typing && (
                      <div className="concierge-row">
                        <img className="concierge-avatar" src="https://placehold.co/32x32?text=AI" alt="AI" />
                        <div className="concierge-bubble assistant concierge-typing">AI is typing…</div>
                      </div>
                    )}
                  </div>
                  <div className="concierge-input">
                    <textarea
                      className="form-control form-control-sm"
                      placeholder="Ask the concierge (press Enter to send)"
                      rows={2}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); const txt = chatInput.trim(); if (txt) sendChat(txt); } }}
                    />
                  </div>
                </div>
              </div>

              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => { sendChat(chatInput.trim() || notes.trim() || 'Please create a plan.'); }}
                  disabled={loading}
                >
                  {loading ? "Working..." : "Send"}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => { setChatInput(''); setNotes(''); }}
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="alert alert-danger py-2 px-3" role="alert">
              {error}
            </div>
          )}

          {loading && (
            <p className="text-muted small">Working on your itinerary…</p>
          )}

          {!loading && data && (
            <>
              {displayPlan.map(day => (
                <div key={day.date} className="mb-4">
                  <h6 className="fw-semibold">{new Date(day.date).toLocaleDateString()}</h6>
                  {["morning", "afternoon", "evening"].map(block => (
                    <div key={block} className="mt-2">
                      <div className="text-uppercase text-muted small">{block}</div>
                      <ul className="ps-3">
                        {(day[block] || []).map((activity, idx) => (
                          <li key={`${block}-${idx}`}>
                            {activity.url ? (
                              <a href={activity.url} target="_blank" rel="noreferrer">
                                {activity.title}
                              </a>
                            ) : (
                              activity.title
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
              {data.restaurants?.length > 0 && (
                <div className="mb-4">
                  <h6 className="fw-semibold">Restaurants</h6>
                  <ul className="ps-3">
                    {data.restaurants.map((r, idx) => (
                      <li key={`restaurant-${idx}`}>
                        {r.url ? (
                          <a href={r.url} target="_blank" rel="noreferrer">
                            {r.title}
                          </a>
                        ) : (
                          r.title
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {data.packing_checklist?.length > 0 && (
                <div className="mb-4">
                  <h6 className="fw-semibold">Packing checklist</h6>
                  <ul className="ps-3">
                    {data.packing_checklist.map((item, idx) => (
                      <li key={`pack-${idx}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
