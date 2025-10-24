import { Router } from "express";
import { pool } from "../db.js";
import { requireOwner } from "../middleware/requireOwner.js";

const router = Router();

router.get("/", async(req,res)=>{
  const { user_id } = req.session.user;
  const [bookings] = await pool.query(
    `SELECT b.booking_id, b.traveler_id, b.property_id, b.start_date, b.end_date, b.guests, b.status, b.created_at,
            p.name AS property_name
     FROM bookings b
     left JOIN properties p ON b.property_id = p.property_id
     where b.status IN ('ACCEPTED')
     ORDER BY b.created_at DESC`,
    [user_id]
  );  
  res.json(bookings)
})

// GET /api/bookings/incoming - bookings for properties owned by the owner
router.get("/incoming", requireOwner, async (req, res) => {
  const { user_id } = req.session.user;
  const [rows] = await pool.query(
    `SELECT b.booking_id, b.traveler_id, b.property_id, b.start_date, b.end_date, b.guests, b.status, b.created_at,
            p.name AS property_name
     FROM bookings b
     JOIN properties p ON b.property_id = p.property_id
     WHERE p.owner_id = ?
     ORDER BY b.created_at DESC`,
    [user_id]
  );
  res.json(rows);
});

// Helper: ensure booking belongs to owner's property
async function getOwnedBooking(bookingId, ownerId) {
  const [rows] = await pool.query(
    `SELECT b.*, p.owner_id
     FROM bookings b
     JOIN properties p ON b.property_id = p.property_id
     WHERE b.booking_id = ? AND p.owner_id = ?`,
    [bookingId, ownerId]
  );
  return rows[0];
}

// PATCH /api/bookings/:id/accept - accept if dates are free
router.patch("/:id/accept", requireOwner, async (req, res) => {
  const { user_id } = req.session.user;
  const { id } = req.params;

  const booking = await getOwnedBooking(id, user_id);
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.status === "ACCEPTED") return res.json({ message: "Already accepted" });

  // Check overlap with other ACCEPTED bookings
  const [conflicts] = await pool.query(
    `SELECT COUNT(*) AS c
     FROM bookings
     WHERE property_id = ?
       AND status = 'ACCEPTED'
       AND NOT (end_date <= ? OR start_date >= ?)`,
    [booking.property_id, booking.start_date, booking.end_date]
  );
  if (conflicts[0].c > 0) {
    return res.status(409).json({ error: "Date conflict with an existing accepted booking" });
  }

  await pool.query("UPDATE bookings SET status = 'ACCEPTED' WHERE booking_id = ?", [id]);
  res.json({ message: "Booking accepted" });
});

// PATCH /api/bookings/:id/cancel
router.patch("/:id/cancel", requireOwner, async (req, res) => {
  const { user_id } = req.session.user;
  const { id } = req.params;

  const booking = await getOwnedBooking(id, user_id);
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  await pool.query("UPDATE bookings SET status = 'CANCELLED' WHERE booking_id = ?", [id]);
  res.json({ message: "Booking cancelled" });
});

export default router;