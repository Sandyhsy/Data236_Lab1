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
  const [guestCount, setGuestCount] = useState(1);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [excludeDates, setExcludeDates] = useState([]);

  useEffect(() => {
    async function init() {
      const p = await api.getProperty(id);
      const d = await api.getBookedDates(id);
      setProperty({
        name: p.name || "",
        profile_picture: p.profile_picture || "",
        pricing: p.price_per_night || "",
        bedrooms: p.bedrooms || "",
        bathrooms: p.bathrooms || "",
        amenities: p.amenities || ""
      });
      setExcludeDates(Array.isArray(d) ? d : []);
    }
    init();
  }, [id]);

    async function clickFavorite() {
    const pid = Number(id)
    const u = await api.TravelerMe();
    const uid = Number(u.user_id)
    try {
        const resp = await api.addFavorite(pid,uid);
        alert(resp.message)
    } catch (e) {
      console.error("Favorite toggle failed", e);
    }
  }

  async function handleSubmitBooking() {

    if (startDate >= endDate) {
      alert("Check-out date must be after check-in date");
      return;
    }

    if (!startDate || !endDate) {
      alert("Please select both check-in and check-out dates");
      return;
    }

    if (endDate <= Date.now()) {
      alert("Booking dates must be in the future");
      return;
    }

    if(guestCount < 1) {
      alert("At least one guest is required");
      return; 
    }

    try {
      const resp = await api.createBooking({
        property_id: Number(id),
        start_date: startDate,
        end_date: endDate,
      });
      alert("Booking request submitted");
    } catch (e) {
      alert(`Booking failed: ${e.message}`);
    }
  }

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
              <label className="form-label">Check-in:</label>
              <DatePicker
                selected={startDate}
                onChange={(date) => setStartDate(date)}
                excludeDateIntervals={excludeDates}
                placeholderText="Choose a check-in date"
                className="form-control"
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">Check-out:</label>
              <DatePicker
                selected={endDate}
                onChange={(date) => setEndDate(date)}
                excludeDateIntervals={excludeDates}
                placeholderText="Choose a check-out date"
                className="form-control"
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">Guests:</label>
              <input
                type="number"
                min={1}
                value={guestCount}
                onChange={(i) => setGuestCount(Number(i.target.value))}
                className="form-control"
              />
            </div>
                        <div className="col-12 col-md-6">
                <button className="btn btn-success mt-4"
                onClick={handleSubmitBooking}
                disabled={!startDate || !endDate}
                title={!startDate ? "Pick check-in first" : (!endDate ? "Pick check-out" : "Submit")}
              > reserve</button>
              </div>
    </div>

  </div>
</div>

</div>
</div>
    </div>
    
  );
}
