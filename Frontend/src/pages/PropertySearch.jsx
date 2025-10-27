import React, { useEffect, useState } from "react";
import { api } from "../api";
import PropertyCardSearch from "../components/PropertyCardSearch";

export default function PropertySearch() {
  const [searchInput, setSearchInput] = useState({ location: "", start: "", end: "", guests: 1 });
  const [items, setItems] = useState([]);
  const load = async () => setItems(await api.loadAllProperties());
  useEffect(() => { load(); }, []);

  const update = (e) => {
    const { name, value } = e.target;
    setSearchInput((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) =>  {
    e.preventDefault();
    const payload = {
        location: searchInput.location,
        start: searchInput.start,
        end: searchInput.end,
        guests: Number(searchInput.guests),
      };
      try{
      const lists = await api.searchProperty(payload);
      setItems(Array.isArray(lists) ? lists : []);
      }
      catch (err){
        console.error("failed to search properties", err)
        setItems([])
      }
  }

  return (
    <div className="container py-4">
      <form className="row g-3 mb-4" onSubmit={handleSubmit}>
        <div className="col-md-4">
          <input
            type="text"
            name="location"
            className="form-control"
            placeholder="Location"
            value={searchInput.location}
            onChange={update}
          />
        </div>
        <div className="col-md-3">
          <input
            type="date"
            name="start"
            className="form-control"
            value={searchInput.start}
            onChange={update}
          />
        </div>
        <div className="col-md-3">
          <input
            type="date"
            name="end"
            className="form-control"
            value={searchInput.end}
            onChange={update}
          />
        </div>
        <div className="col-md-2 d-flex">
          <input
            type="number"
            name="guests"
            min="1"
            className="form-control me-2"
            value={searchInput.guests}
            onChange={update}
          />
          <button type="submit" className="btn btn-primary w-100">
            Search
          </button>
        </div>
      </form>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="m-0">Find your next destination</h5>
      </div>
      <div className="row g-3">
        {items.map(p => (
          <div className="col-12 col-md-6 col-lg-4" key={p.property_id}>
            <PropertyCardSearch p={p} />
          </div>
        ))}
      </div>
    </div>
  );
}