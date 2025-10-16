import React from "react";
import { NavLink, Link, useLocation } from "react-router-dom";

export default function Header({ user, onLogout }) {

  const path = useLocation().pathname

  const amTraveler = path.toLowerCase().startsWith("/traveler")

  return (
    <nav className="navbar navbar-expand-lg bg-white border-bottom sticky-top">
      <div className="container">
        <Link to="/" className="navbar-brand">
          <span className="brand-dot" /> <span className="brand-text">HOME</span>
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navMain"
          aria-controls="navMain"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div id="navMain" className="collapse navbar-collapse">
          <ul className="navbar-nav ms-auto mb-2 mb-lg-0">
            {user ? (
              <>
                <li className="nav-item"><NavLink to="/dashboard" className="nav-link">Dashboard</NavLink></li>
                <li className="nav-item"><NavLink to="/properties" className="nav-link">My Properties</NavLink></li>
                <li className="nav-item"><NavLink to="/profile" className="nav-link">Profile</NavLink></li>
                <li className="nav-item">
                  <button className="btn btn-outline-secondary ms-lg-2" onClick={onLogout}>Logout</button>
                </li>
              </>
            ) : 
              amTraveler ? (
              <>
                <li className="nav-item"><NavLink to="/traveler/login" className="nav-link">Login</NavLink></li>
                <li className="nav-item"><NavLink to="/traveler/signup" className="nav-link">Sign up</NavLink></li>
              </>
            ): (
                            <>
                <li className="nav-item"><NavLink to="/login" className="nav-link">Login</NavLink></li>
                <li className="nav-item"><NavLink to="/signup" className="nav-link">Sign up</NavLink></li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}
