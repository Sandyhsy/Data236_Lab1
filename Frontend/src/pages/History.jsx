import React, { useEffect, useState } from "react";
import { api } from "../api";
import HistoryCard from "../components/HistoryCard";

export default function OwnerDashboard() {

  const [bookHistory, setHistory] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [acceptedRequests, setAcceptedRequests] = useState([]);
  const [canceledRequests, setCanceledRequests] = useState([]);

  const load = async () => {
    const h = await api.getbookings();
    setHistory(Array.isArray(h) ? h : []);

        try {
          const d = await api.getbookingStatus();
          setPendingRequests(Array.isArray(d?.pendingRequests) ? d.pendingRequests : [])
          setAcceptedRequests(Array.isArray(d?.acceptedRequests) ? d.acceptedRequests : [])
          setCanceledRequests(Array.isArray(d?.canceledRequests) ? d.canceledRequests : [])
        }catch (e) {
          console.error("Dashboard load failed:", e);
        } 
  }
  useEffect(() => { load(); }, []);


  return (
    <div className="container py-4">
      <div className="row g-3">
        <div className="col-12 col-md-6">
        </div>
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
  );
}