import React, { useEffect, useState } from "react";
import { api } from "../api";
import PropertyCardSearch from "../components/PropertyCardSearch";
import HistoryCard from "../components/HistoryCard";

export default function OwnerDashboard() {

  const [bookHistory, setHistory] = useState([]);

  const load = async () => setHistory(await api.getbookings());

  useEffect(() => { load(); }, []);


  return (
    <div className="container py-4">
      <div className="row g-3">
        <div className="col-12 col-md-6">
        </div>

        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <div className="h6 fw-bold mb-3">Past trips</div>
              <div className="row g-1">
                {bookHistory.length === 0 && <div className="text-secondary small">No history.</div>}
                {bookHistory.map(b => (
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
  );
}