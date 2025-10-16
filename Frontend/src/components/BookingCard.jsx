import React from "react";

export default function BookingCard({ b, onAccept, onCancel }) {
  const statusClass =
    b.status === "ACCEPTED" ? "text-bg-success" :
    b.status === "CANCELLED" ? "text-bg-secondary" : "text-bg-warning";

  return (
    <div className="card">
      <div className="card-body d-flex justify-content-between align-items-center">
        <div>
          <div className="fw-bold">{b.property_name}</div>
          <div className="d-flex flex-wrap gap-2 mt-2">
            <span className="badge text-bg-light">#{b.booking_id}</span>
            <span className="badge text-bg-light">{b.start_date} - {b.end_date}</span>
            {b.guests != null && <span className="badge text-bg-light">{b.guests} guests</span>}
            <span className={`badge ${statusClass}`}>{b.status}</span>
          </div>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-primary" disabled={b.status === "ACCEPTED"} onClick={() => onAccept(b)}>Accept</button>
          <button className="btn btn-outline-secondary" disabled={b.status === "CANCELLED"} onClick={() => onCancel(b)}>Cancel</button>
        </div>
      </div>
    </div>
  );
}