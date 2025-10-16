import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import PropertyCard from "../components/PropertyCard";

export default function PropertiesList() {
  const [items, setItems] = useState([]);
  const nav = useNavigate();
  const load = async () => setItems(await api.myProperties());
  useEffect(() => { load(); }, []);

  const onEdit = (p) => nav(`/properties/${p.property_id}`, { state: { p } });
  const onDelete = async (p) => { if (window.confirm("Delete this property?")) { await api.deleteProperty(p.property_id); await load(); } };

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="m-0">My Properties</h5>
        <button className="btn btn-danger" onClick={() => nav("/properties/new")}>Add property</button>
      </div>
      <div className="row g-3">
        {items.map(p => (
          <div className="col-12 col-md-6 col-lg-4" key={p.property_id}>
            <PropertyCard p={p} onEdit={onEdit} onDelete={onDelete} />
          </div>
        ))}
        {items.length === 0 && <div className="alert alert-light">No properties yet. Click "Add property".</div>}
      </div>
    </div>
  );
}