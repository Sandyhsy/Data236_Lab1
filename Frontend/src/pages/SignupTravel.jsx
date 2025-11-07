import React, { useState } from "react";
import { api } from "../api";

export default function SignupTravel({ onSignup }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", city: "", country: "" });
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    try{
      const d = await api.signup({...form, role: "traveler"});
      onSignup(d.user);
    }catch(e){
      setErr(e.message);
    }
  };

  return (
    <div className="container py-4">
      <div className="card">
        <div className="card-body">
          <h6 className="fw-bold mb-3">Traveler Sign up</h6>
          <form onSubmit={submit}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Name</label>
                <input className="form-control" value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/>
              </div>
              <div className="col-md-6">
                <label className="form-label">Email</label>
                <input className="form-control" type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/>
              </div>
              <div className="col-md-6">
                <label className="form-label">Password</label>
                <input className="form-control" type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/>
              </div>
              <div className="col-12 d-flex justify-content-end">
                <button className="btn btn-danger" type="submit">Create account</button>
              </div>
            </div>
            {err && <div className="text-danger mt-2 small">{err}</div>}
          </form>
        </div>
      </div>
    </div>
  );
}
