import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

router.get("/", async (req, res) => {
  const { user_id } = req.session.user;
  const [rows] = await pool.query(`SELECT 
    p.property_id,
    p.name,
    p.location,
    p.price_per_night,
    p.bedrooms,
    p.bathrooms,
    p.amenities,
    p.description
FROM favorites f
LEFT JOIN properties p ON p.property_id = f.property_id
WHERE f.traveler_id =?`, [user_id]);
  res.json(rows);
});

router.post("/", async (req, res) => {
  const uid = req.session.user.user_id 
  const pid = req.body.property_id
  if (!uid || !pid) return res.status(400).json({ error: "user_id and property_id are required" });

  const [result] = await pool.query(
    `INSERT INTO favorites (traveler_id, property_id) values
     (?, ?)`,
    [uid, pid]
  );
    const [rows] = await pool.query("SELECT * FROM favorites WHERE favorite_id = ?", [result.insertId]);
  res.status(201).json(rows[0]);
});

export default router;