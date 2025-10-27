import React from "react";
import { useNavigate } from "react-router-dom";

export default function HistoryCard({ b }) {
  const nav = useNavigate();
  if (!b) return null;

  return (
    <div className="card">
      <div className="card-body d-flex justify-content-between align-items-center"
              style={{ padding: 0 }}>        
        <div
            style={{ cursor: "pointer" }}
          onClick={() => nav(`/property/${b.property_id}`)}
          >
          <img className="img-cover" src="https://placehold.co/360x200?text=Property" alt={b.property_name || "Property image"} />
          <div className="fw-bold">{b.property_name}</div>
          <div className="d-flex flex-wrap gap-2 mt-2">
            <span className="badge text-bg-light">#{b.booking_id}</span>
            <span className="badge text-bg-light">
              {new Date(b.start_date).toISOString().split("T")[0]} - {new Date(b.end_date).toISOString().split("T")[0]}
            </span>
            {b.guests != null && <span className="badge text-bg-light">{b.guests} guests</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
