import React, { useState } from "react";
import { api } from "../api";

export default function LoginTravel({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      const d = await api.login({ email, password, role:"traveler" });
      onLogin(d.user);
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="container py-4">
      <div className="row g-3">
        <div className="col-12 col-md-6">
          <div className="card">
            <div className="card-body">
              <h6 className="fw-bold mb-3">traveler Login</h6>
              <form onSubmit={submit}>
                <label className="form-label">Email</label>
                <input className="form-control" value={email} onChange={e=>setEmail(e.target.value)} placeholder="owner@example.com" />
                <label className="form-label mt-3">Password</label>
                <input className="form-control" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="********" />
                {err && <div className="text-danger mt-2 small">{err}</div>}
                <div className="mt-3 d-flex gap-2">
                  <button className="btn btn-danger" type="submit">Login</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
