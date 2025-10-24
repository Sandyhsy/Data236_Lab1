import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { api } from "./api";
import Start from "./pages/Start";
import Header from "./components/Header";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import OwnerDashboard from "./pages/OwnerDashboard";
import Profile from "./pages/Profile";
import PropertiesList from "./pages/PropertiesList";
import PropertyForm from "./pages/PropertyForm";
import Login_Travel from "./pages/Login_Travel";
import Signup_Travel from "./pages/Signup_Travel";
import PropertySearch from "./pages/PropertySearch";
import Property from "./pages/Property";
import History from "./pages/History";

import FavoriteList from "./pages/FavoriteList";


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
  // const isOwner
  return (
    <>
      <Header user={user} onLogout={async () => { await api.logout(); setUser(null); }} />
      <div>
        <Routes> 
          <Route path="/" element={isAuthed ?<Profile />: <Start />} />
          <Route path="/login" element={isAuthed ? <Navigate to="/dashboard" /> : <Login onLogin={setUser} />} />
          <Route path="/signup" element={isAuthed ? <Navigate to="/dashboard" /> : <Signup onSignup={setUser} />} />
          <Route path="/traveler/login" element={isAuthed ? <Navigate to="/search" /> : <Login_Travel onLogin={setUser} />} />
          <Route path="/traveler/signup" element={isAuthed ? <Navigate to="/dashboard" /> : <Signup_Travel onSignup={setUser} />} />          
          <Route path="/dashboard" element={isAuthed ? <OwnerDashboard /> : <Navigate to="/login" state={{ from: location }} />} />
          <Route path="/profile" element={isAuthed ? <Profile /> : <Navigate to="/login" />} />
          <Route path="/properties" element={isAuthed ? <PropertiesList /> : <Navigate to="/login" />} />
          <Route path="/properties/new" element={isAuthed ? <PropertyForm /> : <Navigate to="/login" />} />
          <Route path="/properties/:id" element={isAuthed ? <PropertyForm edit /> : <Navigate to="/login" />} />
          <Route path="/search" element={isAuthed ? <PropertySearch edit /> : <Navigate to="/login" />} />
          <Route path="/property/:id" element={<Property />} />
          <Route path="/favorite" element={<FavoriteList />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </div>
    </>
  );
}