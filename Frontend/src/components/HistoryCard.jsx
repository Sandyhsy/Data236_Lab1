import React from "react";
import { useNavigate } from "react-router-dom";

export default function HistoryCard({ b }) {
  const nav = useNavigate();
  if (!b) return null;

  const start = new Date(b.start_date).toISOString().split("T")[0];
  const end = new Date(b.end_date).toISOString().split("T")[0];

  return (
<<<<<<< HEAD
    <div className="card">
      <button
        type="button"
        className="card-body d-flex justify-content-between align-items-center w-100 btn btn-link text-start"
        style={{ padding: 0, textDecoration: "none" }}
        onClick={() => nav(`/property/${b.property_id}`)}
      >
        <div>
          <img
            className="img-cover"
            src="https://placehold.co/360x200?text=Property"
            alt={b.property_name || "Property image"}
          />
=======
    <div className="card shadow-sm overflow-hidden" style={{ width: "45%" }}>
      <div className="card-body d-flex justify-content-between align-items-center" style={{ padding: 0 }}>
        <div style={{ cursor: "pointer" }} onClick={() => nav(`/property/${b.property_id}`)}>
          {b.first_image_url && (<img className="w-100 d-block" src={b.first_image_url} alt={b.name} style={{ height: 220, objectFit: "cover" }}/>)}
>>>>>>> e7ee570fe4c926e273a6fb63a4ce20f1d7f3d23c
          <div className="fw-bold">{b.property_name}</div>
          <div className="d-flex flex-wrap gap-2 mt-2">
            <span className="badge text-bg-light">#{b.booking_id}</span>
            <span className="badge text-bg-light">
              {start} - {end}
            </span>
            {b.guests != null && <span className="badge text-bg-light">{b.guests} guests</span>}
          </div>
        </div>
      </button>
    </div>
  );
}
