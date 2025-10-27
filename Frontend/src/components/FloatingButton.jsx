import { useEffect, useMemo, useState } from "react";

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

  const hasBooking = !!selectedBooking;

  const displayPlan = useMemo(() => {
    if (!data?.plan) return [];
    return data.plan;
  }, [data]);

  const callAgent = async () => {
    setOpen(true);
    setError(null);

    const active = selectedBooking ?? booking ?? null;
    if (!active) {
      setLoading(false);
      setData(null);
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

    if (!payloadBooking.booking_id && (!payloadBooking.location || !payloadBooking.start_date || !payloadBooking.end_date)) {
      setLoading(false);
      setData(null);
      setError("Booking details are incomplete. Please open one of your trips to generate a plan.");
      return;
    }

    if (!payloadBooking.start_date || !payloadBooking.end_date) {
      setLoading(false);
      setData(null);
      setError("Trip dates are missing.");
      return;
    }

    setData(null);
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8001/ai/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking: payloadBooking,
          free_text: notes.trim()
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${res.status})`);
      }

      const body = await res.json();
      setData(body);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to contact the concierge agent.");
      setData(null);
    } finally {
      setLoading(false);
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
        onClick={callAgent}
        className="btn btn-primary rounded-pill shadow-lg"
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 1040,
          padding: "12px 20px",
          fontWeight: 600
        }}
        disabled={!bookings.length && !booking}
      >
        AI Concierge
      </button>

      <div style={panelStyle} aria-hidden={!open}>
        <div style={panelHeaderStyle}>
          <h5 className="mb-0">Your Trip Plan</h5>
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
                <textarea
                  className="form-control form-control-sm"
                  placeholder="Add dietary needs, interests, mobility notes..."
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={callAgent}
                disabled={loading}
              >
                {loading ? "Generating..." : "Generate plan"}
              </button>
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
