// src/pages/RoleChooser.jsx
import { Link } from "react-router-dom";

export default function Start() {
  return (
    <div className="container py-5">
      <h1 className="mb-4 text-center">Welcome! Who are you?</h1>

      <div className="row g-4 justify-content-center">
        {/* Owner card */}
        <div className="col-12 col-md-5">
          <div className="card shadow-sm h-100">
            <div className="card-body d-flex flex-column">
              <h3 className="card-title">I’m an Owner</h3>
              <div className="mt-auto d-flex gap-2">
                <Link className="btn btn-primary" to="/login">
                  I’m an Owner
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Traveler card */}
        <div className="col-12 col-md-5">
          <div className="card shadow-sm h-100">
            <div className="card-body d-flex flex-column">
              <h3 className="card-title">I’m a Traveler</h3>
              <div className="mt-auto d-flex gap-2">
                <Link className="btn btn-secondary" to="/traveler/login">
                  I’m a Traveler
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
