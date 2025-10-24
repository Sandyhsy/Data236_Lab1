import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import DatePicker from "react-datepicker";

import "react-datepicker/dist/react-datepicker.css";





export default function Property() {
    const {id} = useParams();
  const [property, setProperty] = useState({
    name: "",
    type: "",
    amenities: "",
    pricing: "",
    bedrooms: "",
    bathrooms: "",
    profile_picture: ""
  });

  const [bookings, setBookings] = useState([]);
   const [checkout, setCheckout] = useState(null);
     const [checkin, setCheckin] = useState(null);


  useEffect(() => {
    async function init() {
      const p = await api.getProperty(id);
      setProperty({
        name: p.name || "",
        profile_picture: p.profile_picture || "",
        pricing: p.price_per_night || "",
        bedrooms: p.bedrooms || "",
        bathrooms: p.bathrooms || "",
        amenities: p.amenities || ""
      });

        const b = await api.getBooking(id);
        setBookings(Array.isArray(b) ? b : []);
    }
    init();
  }, [id]);

    async function clickFavorite() {
    // if (!property || favBusy) return;
    // setFavBusy(true);
    const pid = Number(id)
    const u = await api.TravelerMe();
    const uid = Number(u.user_id)
    try {
        await api.addFavorite(pid,uid);
    } catch (e) {
      console.error("Favorite toggle failed", e);
      // Optional: show a toast/alert
    }
  }

const excludeIntervals = bookings
  .filter(b => b.start_date && b.end_date)
  .map(b => ({ start: new Date(b.start_date), end: new Date(b.end_date) }));

  return (
    <div className="container py-4">
      {/* Full-width image */}
      <div className="mb-4">
        <div className="w-100 overflow-hidden rounded" style={{ maxHeight: "500px" }}>
          <img
            src={property.profile_picture || "https://placehold.co/800x300?text=Profile"}
            alt="profile"
            className="w-100"
            style={{ objectFit: "cover" }}
          />
        </div>
      </div>
                <div className="card">
            <div className="card-body">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex align-items-center gap-3">
        <h3 className="m-0 fw-semibold">{property.name}</h3>
       <button
          type="button"
          onClick={clickFavorite}
         className={`btn fs-1`}>
        {'\u2764'}
        </button>
        </div>
        <h3 className="m-0 fw-semibold"><span className="badge text-bg-danger">${property.pricing}/night</span></h3>
      </div>

      <div className="d-flex align-items-center gap-3 mb-4">
        <div className="d-inline-flex align-items-center">
          <span className="me-2 fw-semibold">Bedrooms:{property.bedrooms} </span>
        </div>
        <div className="d-inline-flex align-items-center">
          <span className="me-2 fw-semibold">Bathrooms:{property.bathrooms}</span>
        </div>
      </div>

      <div className="mb-3">
        <span
          className="border rounded px-2 py-1"
          style={{ display: "inline-block", width: "auto" }}
        >
          amenities: {property.amenities}
        </span>
      </div>
<div className="card mt-3">
  <div className="card-body">
    <h6 className="mb-3">Select your dates</h6>
    <div className="row g-2">
            <div className="col-12 col-md-6">
              <label className="form-label">Check-in</label>
              <DatePicker
                
                selectsStart
                startDate={checkin}
                endDate={checkout}
                excludeDateIntervals={excludeIntervals}
                placeholderText="Choose a check-in date"
                className="form-control"
              />
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label">Check-out</label>
              <DatePicker
                selectsEnd
                startDate={checkin}
                endDate={checkout}
                excludeDateIntervals={excludeIntervals}
                placeholderText="Choose a check-out date"
                className="form-control"
              />
            </div>
    </div>

  </div>
</div>

</div>
</div>
    </div>
    
  );
}
