// Owner routes: /api/owner/*
import { Router } from "express";
import { pool } from "../db.js";
import { requireOwner } from "../middleware/requireOwner.js";

const router = Router();

// GET /api/owner/me - current owner profile (no password)
router.get("/me", requireOwner, async (req, res) => {
  const { user_id } = req.session.user;
  const [rows] = await pool.query(
    `SELECT user_id, role, name, email, phone, about_me, city, country, languages, gender, profile_picture, created_at
     FROM users
     WHERE user_id = ? AND role = 'owner'`,
    [user_id]
  );
  if (rows.length === 0) return res.status(404).json({ error: "Owner not found" });
  res.json(rows[0]);
});

// PUT /api/owner/me - update owner profile
router.put("/me", requireOwner, async (req, res) => {
  const { user_id } = req.session.user;
  const { name, phone, about_me, city, country, languages, gender, profile_picture } = req.body;

  await pool.query(
    `UPDATE users SET
       name = COALESCE(?, name),
       phone = COALESCE(?, phone),
       about_me = COALESCE(?, about_me),
       city = COALESCE(?, city),
       country = COALESCE(?, country),
       languages = COALESCE(?, languages),
       gender = COALESCE(?, gender),
       profile_picture = COALESCE(?, profile_picture)
     WHERE user_id = ? AND role = 'owner'`,
    [name, phone, about_me, city, country, languages, gender, profile_picture, user_id]
  );

  const [rows] = await pool.query(
    `SELECT user_id, role, name, email, phone, about_me, city, country, languages, gender, profile_picture, created_at
     FROM users
     WHERE user_id = ? AND role = 'owner'`,
    [user_id]
  );
  res.json(rows[0]);
});

// GET /api/owner/dashboard - stats + recent requests + history
router.get("/dashboard", requireOwner, async (req, res) => {
  const { user_id } = req.session.user;

  const [[{ total_props = 0 }]] = await pool.query(
    "SELECT COUNT(*) AS total_props FROM properties WHERE owner_id = ?", [user_id]
  );
  const [[{ incoming = 0 }]] = await pool.query(
    `SELECT COUNT(*) AS incoming
     FROM bookings b JOIN properties p ON b.property_id = p.property_id
     WHERE p.owner_id = ? AND b.status = 'PENDING'`,
    [user_id]
  );

  const [recentRequests] = await pool.query(
    `SELECT b.booking_id, b.traveler_id, b.property_id, b.start_date, b.end_date, b.guests, b.status, b.created_at,
            p.name AS property_name
     FROM bookings b
     JOIN properties p ON b.property_id = p.property_id
     WHERE p.owner_id = ?
     ORDER BY b.created_at DESC
     LIMIT 10`,
    [user_id]
  );

  const [previousBookings] = await pool.query(
    `SELECT b.booking_id, b.traveler_id, b.property_id, b.start_date, b.end_date, b.guests, b.status, b.created_at,
            p.name AS property_name
     FROM bookings b
     JOIN properties p ON b.property_id = p.property_id
     WHERE p.owner_id = ? AND b.status IN ('ACCEPTED','CANCELLED')
     ORDER BY b.created_at DESC
     LIMIT 10`,
    [user_id]
  );

  res.json({
    total_props: Number(total_props || 0),
    incoming: Number(incoming || 0),
    recentRequests: Array.isArray(recentRequests) ? recentRequests : [],
    previousBookings: Array.isArray(previousBookings) ? previousBookings : []
  });
});

export default router;