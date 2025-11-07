import React from "react";
import { useNavigate } from "react-router-dom";

export default function HistoryCard({ b }) {
  const nav = useNavigate();
  if (!b) return null;

  const nightly = Number(b.nightly_price ?? 0);
  const nights = Number(b.nights ?? 0);
  const showBreakdown = nightly > 0 && nights > 0;

  const start = new Date(b.start_date);
  const end = new Date(b.end_date);
  const dateRange = `${start.toISOString().split("T")[0]} - ${end
    .toISOString()
    .split("T")[0]}`;

  return (
    <div
      className="card history-card shadow-sm"
      role="button"
      onClick={() => nav(`/property/${b.property_id}`)}
      // Keep a friendly width; let parent flex wrap
      style={{ width: "min(560px, 100%)" }}
    >
      <div className="position-relative overflow-hidden">
        {b.first_image_url && (
          <img
            className="w-100 history-card__image"
            src={b.first_image_url}
            alt={b.property_name || "Property"}
            style={{ height: 220, objectFit: "cover" }}
          />
        )}

        {/* Title overlay with subtle gradient */}
        <div className="history-card__title-overlay">
          <div className="fw-semibold text-white text-truncate">
            {b.property_name}
          </div>
        </div>
      </div>

      <div className="card-body">
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <span className="badge rounded-pill text-bg-light">#{b.booking_id}</span>
          <span className="badge rounded-pill text-bg-light">{dateRange}</span>
          {b.guests != null && (
            <span className="badge rounded-pill text-bg-light">
              {b.guests} {b.guests === 1 ? "guest" : "guests"}
            </span>
          )}
          {showBreakdown && (
            <span className="badge rounded-pill text-bg-secondary">
              ${nightly} / night × {nights}
            </span>
          )}
        </div>

        {/* Secondary line for clarity on total */}
        {showBreakdown && (
          <div className="mt-2 badge text-bg-danger">
            Total price <span className="fw-semibold">${b.total_price}</span>
          </div>
        )}
      </div>
    </div>
  );
}
