import React from "react";
import { useNavigate } from "react-router-dom";
export default function PropertyCardSearch({ p, onEdit, onDelete }) {

  const nav = useNavigate();

  return (
    <div className="card h-100"
    style={{ cursor: "pointer" }}
    onClick={() => nav(`/property/${p.property_id}`)}
    >
      {/* {p.first_image_url && <img className="img-cover" src={p.first_image_url} alt={p.name} />} */}
  <img className="img-cover" src="https://placehold.co/360x200?text=Property" alt={p.name || "Property image"} />
      <div className="card-body d-flex flex-column">
        <h5 className="card-title fw-bold">{p.name}</h5>
        <div className="mb-2 d-flex flex-wrap gap-2">
          {p.type && <span className="badge text-bg-light">{p.type}</span>}
          {p.location && <span className="badge text-bg-light">{p.location}</span>}
          {p.bedrooms != null && <span className="badge text-bg-light">{p.bedrooms} bd</span>}
          {p.bathrooms != null && <span className="badge text-bg-light">{p.bathrooms} ba</span>}
          {p.price_per_night != null && <span className="badge text-bg-danger">${Number(p.price_per_night).toFixed(2)}/night</span>}
        </div>
        {p.description && <p className="text-secondary small mb-3">{p.description}</p>}
      </div>
    </div>
  );
}
