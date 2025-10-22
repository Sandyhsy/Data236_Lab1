import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import PropertyCard from "../components/PropertyCard";

export default function FavoriteList() {
  const [items, setItems] = useState([]);
  const nav = useNavigate();
  const load = async () => setItems(await api.myfavorites());
  useEffect(() => { load(); }, []);

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="m-0">My favorite property</h5>
      </div>
      <div className="row g-3">
        {items.map(p => (
          <div className="col-12 col-md-6 col-lg-4" key={p.property_id}>
            <PropertyCard p={p} />
          </div>
        ))}
      </div>
    </div>
  );
}