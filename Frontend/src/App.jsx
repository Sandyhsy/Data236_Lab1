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
import LoginTravel from "./pages/LoginTravel";
import SignupTravel from "./pages/SignupTravel";
import PropertySearch from "./pages/PropertySearch";
import Property from "./pages/Property";
import History from "./pages/History";

import FavoriteList from "./pages/FavoriteList";
import ConciergeChat from "./components/ConciergeChat";

function toMillis(value, fallback) {
  if (!value) return fallback;
  const parsed = new Date(value);
  const ms = parsed.getTime();
  return Number.isNaN(ms) ? fallback : ms;
}


export default function App() {
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [conciergeBookings, setConciergeBookings] = useState([]);
  const [primaryConciergeBooking, setPrimaryConciergeBooking] = useState(null);
  const location = useLocation();

  useEffect(() => {
    api.me().then(d => {
      setUser(d.user);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!user || user.role !== "traveler") {
      setConciergeBookings([]);
      setPrimaryConciergeBooking(null);
      return;
    }

    let cancelled = false;

    const loadConciergeData = async () => {
      try {
        const historyPromise = api.getbookings().catch(() => []);
        const statusPromise = api.getbookingStatus().catch(() => ({}));
        const [historyRaw, statusRaw] = await Promise.all([historyPromise, statusPromise]);

        if (cancelled) return;

        const history = Array.isArray(historyRaw) ? historyRaw : [];
        const pending = Array.isArray(statusRaw?.pendingRequests) ? statusRaw.pendingRequests : [];
        const accepted = Array.isArray(statusRaw?.acceptedRequests) ? statusRaw.acceptedRequests : [];
        const canceled = Array.isArray(statusRaw?.canceledRequests) ? statusRaw.canceledRequests : [];

        const acceptedSorted = accepted.slice().sort(
          (a, b) =>
            toMillis(a?.start_date ?? a?.startDate, Number.MAX_SAFE_INTEGER) -
            toMillis(b?.start_date ?? b?.startDate, Number.MAX_SAFE_INTEGER)
        );
        const pendingSorted = pending.slice().sort(
          (a, b) =>
            toMillis(a?.start_date ?? a?.startDate, Number.MAX_SAFE_INTEGER) -
            toMillis(b?.start_date ?? b?.startDate, Number.MAX_SAFE_INTEGER)
        );
        const historySorted = history.slice().sort(
          (a, b) =>
            toMillis(a?.start_date ?? a?.startDate, 0) -
            toMillis(b?.start_date ?? b?.startDate, 0)
        );
        const canceledSorted = canceled.slice();

        const seen = new Set();
        const combined = [];
        const pushUnique = (arr) => {
          arr.forEach((booking) => {
            const key = booking?.booking_id ?? booking?.id;
            if (!key || seen.has(key)) return;
            seen.add(key);
            combined.push(booking);
          });
        };

        pushUnique(acceptedSorted);
        pushUnique(pendingSorted);
        pushUnique(historySorted);
        pushUnique(canceledSorted);

        setConciergeBookings(combined);
        setPrimaryConciergeBooking(combined[0] || null);
      } catch (err) {
        console.error("Failed loading concierge data", err);
        if (!cancelled) {
          setConciergeBookings([]);
          setPrimaryConciergeBooking(null);
        }
      }
    };

    loadConciergeData();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!loaded) return null;
  const isAuthed = !!user;
  // const isOwner
  return (
    <>
      <Header user={user} onLogout={async () => { await api.logout(); setUser(null); window.location.replace("/"); }} />
      <div>
        <Routes> 
          <Route path="/" element={isAuthed ?<Profile />: <Start />} />
          <Route path="/login" element={isAuthed ? <Navigate to="/dashboard" /> : <Login onLogin={setUser} />} />
          <Route path="/signup" element={isAuthed ? <Navigate to="/dashboard" /> : <Signup onSignup={setUser} />} />
          <Route path="/traveler/login" element={isAuthed ? <Navigate to="/search" /> : <LoginTravel onLogin={setUser} />} />
          <Route path="/traveler/signup" element={isAuthed ? <Navigate to="/dashboard" /> : <SignupTravel onSignup={setUser} />} />          
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
      <ConciergeChat
        user={user}
        booking={primaryConciergeBooking}
        bookings={conciergeBookings}
      />
    </>
  );
}
