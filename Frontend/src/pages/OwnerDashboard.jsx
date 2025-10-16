import React, { useEffect, useState } from "react";
import { api } from "../api";
import BookingCard from "../components/BookingCard";

export default function OwnerDashboard() {
  // 1) Safe initial shape so .length exists
  const [stats, setStats] = useState({
    total_props: 0,
    incoming: 0,
    recentRequests: [],
    previousBookings: []
  });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const d = await api.dashboard();
      // 2) Normalize response to avoid undefined
      setStats({
        total_props: Number(d?.total_props ?? 0),
        incoming: Number(d?.incoming ?? 0),
        recentRequests: Array.isArray(d?.recentRequests) ? d.recentRequests : [],
        previousBookings: Array.isArray(d?.previousBookings) ? d.previousBookings : []
      });
    } catch (e) {
      // Optional: keep UI usable even if API fails
      setStats({ total_props: 0, incoming: 0, recentRequests: [], previousBookings: [] });
      console.error("Dashboard load failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const accept = async (b) => { await api.acceptBooking(b.booking_id); await load(); };
  const cancel = async (b) => { await api.cancelBooking(b.booking_id); await load(); };

  if (loading) return <div className="container py-4"><div className="alert alert-light">Loading...</div></div>;

  // 3) Always read arrays via fallback to avoid "undefined.length"
  const recent = stats.recentRequests ?? [];
  const history = stats.previousBookings ?? [];

  return (
    <div className="container py-4">
      <div className="row g-3">
        <div className="col-12 col-md-6">
          <div className="card">
            <div className="card-body d-flex justify-content-between">
              <div>
                <div className="text-secondary">Total properties</div>
                <div className="fs-3 fw-bold text-danger">{stats.total_props}</div>
              </div>
              <div className="text-end">
                <div className="text-secondary">Pending requests</div>
                <div className="fs-3 fw-bold text-danger">{stats.incoming}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent booking requests */}
        <div className="col-12 col-md-6">
          <div className="card h-100">
            <div className="card-body">
              <div className="h6 fw-bold mb-3">Recent booking requests</div>
              <div className="d-flex flex-column gap-2">
                {recent.length === 0 && <div className="text-secondary small">No requests yet.</div>}
                {recent.map(b => (
                  <BookingCard key={b.booking_id} b={b} onAccept={accept} onCancel={cancel} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* History bookings */}
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <div className="h6 fw-bold mb-3">History bookings</div>
              <div className="row g-2">
                {history.length === 0 && <div className="text-secondary small">No history.</div>}
                {history.map(b => (
                  <div className="col-12 col-md-6" key={b.booking_id}>
                    <BookingCard b={b} onAccept={accept} onCancel={cancel} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}