import React, { useEffect, useState } from "react";
import { api } from "../api";
import HistoryCard from "../components/HistoryCard";
import ConciergeButton from "../components/FloatingButton";

function toMillis(value, fallback) {
  if (!value) return fallback;
  const parsed = new Date(value);
  const ms = parsed.getTime();
  return Number.isNaN(ms) ? fallback : ms;
}

export default function OwnerDashboard() {

  const [bookHistory, setHistory] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [acceptedRequests, setAcceptedRequests] = useState([]);
  const [canceledRequests, setCanceledRequests] = useState([]);
  const [bookingOptions, setBookingOptions] = useState([]);
  const [primaryBooking, setPrimaryBooking] = useState(null);

  const load = async () => {
    const h = await api.getbookings();
    const historyData = Array.isArray(h) ? h : [];
    setHistory(historyData);

    let pending = [];
    let accepted = [];
    let canceled = [];

    try {
      const d = await api.getbookingStatus();
      console.log(" history:", d);
      pending = Array.isArray(d?.pendingRequests) ? d.pendingRequests : [];
      accepted = Array.isArray(d?.acceptedRequests) ? d.acceptedRequests : [];
      canceled = Array.isArray(d?.canceledRequests) ? d.canceledRequests : [];
    } catch (e) {
      console.error("Dashboard load failed:", e);
    }

    setPendingRequests(pending);
    setAcceptedRequests(accepted);
    setCanceledRequests(canceled);

    const acceptedSorted = accepted.slice().sort(
      (a, b) =>
        toMillis(a?.start_date ?? a?.startDate, Number.MAX_SAFE_INTEGER) -
        toMillis(b?.start_date ?? b?.startDate, Number.MAX_SAFE_INTEGER)
    );
    const pendingSorted = pending.slice().sort(
      (a, b) =>
        toMillis(a?.start_date ?? a?.startDate, Number.MAX_SAFE_INTEGER) -
        toMillis(b?.start_date ?? b?.startDate, Number.MAX_SAFE_INTEGER)
    );
    const historySorted = historyData.slice().sort(
      (a, b) =>
        toMillis(a?.start_date ?? a?.startDate, 0) -
        toMillis(b?.start_date ?? b?.startDate, 0)
    );
    const canceledSorted = canceled.slice();

    const seen = new Set();
    const combined = [];
    const pushUnique = (arr) => {
      arr.forEach((booking) => {
        const key = booking?.booking_id ?? booking?.id;
        if (!key || seen.has(key)) return;
        seen.add(key);
        combined.push(booking);
      });
    };

    pushUnique(acceptedSorted);
    pushUnique(pendingSorted);
    pushUnique(historySorted);
    pushUnique(canceledSorted);

    setBookingOptions(combined);
    setPrimaryBooking(combined[0] || null);
  };

  useEffect(() => { load(); }, []);


  return (
    <>
      <ConciergeButton booking={primaryBooking} bookings={bookingOptions} />
      <div className="container py-4">
        <div className="row g-3">
          <div className="col-12 col-md-6" />

          <div className="col-12">
            <div className="card">
              <div className="card-body">
                <div className="h6 fw-bold mb-3">Pending</div>
                <div className="row g-1">
                  {pendingRequests.length === 0 && <div className="text-secondary small">No Pending request yet.</div>}
                  {pendingRequests.map(b => (
                    <div className="col-12 col-md-6" key={b.booking_id}>
                      <HistoryCard b={b} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="col-12">
            <div className="card">
              <div className="card-body">
                <div className="h6 fw-bold mb-3">Accepted</div>
                <div className="row g-1">
                  {acceptedRequests.length === 0 && <div className="text-secondary small">No Accepted request yet.</div>}
                  {acceptedRequests.map(b => (
                    <div className="col-12 col-md-6" key={b.booking_id}>
                      <HistoryCard b={b} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="col-12">
            <div className="card">
              <div className="card-body">
                <div className="h6 fw-bold mb-3">Canceled</div>
                <div className="row g-1">
                  {canceledRequests.length === 0 && <div className="text-secondary small">No Canceled request yet.</div>}
                  {canceledRequests.map(b => (
                    <div className="col-12 col-md-6" key={b.booking_id}>
                      <HistoryCard b={b} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="col-12">
            <div className="card">
              <div className="card-body">
                <div className="h6 fw-bold mb-3">Past trips</div>
                <div className="row g-1">
                  {bookHistory.length === 0 && <div className="text-secondary small">No history.</div>}
                  {bookHistory.map(b => (
                    console.log("hist request:", b.property_name),
                    <div className="col-12 col-md-6" key={b.booking_id}>
                      <HistoryCard b={b} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
