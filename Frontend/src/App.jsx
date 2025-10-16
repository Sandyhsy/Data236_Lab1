import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { api } from "./api";
import Header from "./components/Header";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import OwnerDashboard from "./pages/OwnerDashboard";
import Profile from "./pages/Profile";
import PropertiesList from "./pages/PropertiesList";
import PropertyForm from "./pages/PropertyForm";

export default function App() {
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const location = useLocation();

  useEffect(() => {
    api.me().then(d => {
      setUser(d.user);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  if (!loaded) return null;
  const isAuthed = !!user;

  return (
    <>
      <Header user={user} onLogout={async () => { await api.logout(); setUser(null); }} />
      <div>
        <Routes>
          <Route path="/" element={isAuthed ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
          <Route path="/login" element={isAuthed ? <Navigate to="/dashboard" /> : <Login onLogin={setUser} />} />
          <Route path="/signup" element={isAuthed ? <Navigate to="/dashboard" /> : <Signup onSignup={setUser} />} />
          <Route path="/dashboard" element={isAuthed ? <OwnerDashboard /> : <Navigate to="/login" state={{ from: location }} />} />
          <Route path="/profile" element={isAuthed ? <Profile /> : <Navigate to="/login" />} />
          <Route path="/properties" element={isAuthed ? <PropertiesList /> : <Navigate to="/login" />} />
          <Route path="/properties/new" element={isAuthed ? <PropertyForm /> : <Navigate to="/login" />} />
          <Route path="/properties/:id" element={isAuthed ? <PropertyForm edit /> : <Navigate to="/login" />} />
        </Routes>
      </div>
    </>
  );
}