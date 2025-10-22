import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

router.get("/profile", async (req, res) => {
  const { user_id } = req.session.user;
  const [rows] = await pool.query(
    `SELECT user_id, role, name, email, phone, about_me, city, country, languages, gender, profile_picture, created_at
     FROM users
     WHERE user_id = ?`,
    [user_id]
  );
  if (rows.length === 0) return res.status(404).json({ error: "traveler not found" });
  res.json(rows[0]);
});

router.put("/profile", async (req, res) => {
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
     WHERE user_id = ?`,
    [name, phone, about_me, city, country, languages, gender, profile_picture, user_id]
  );

  const [rows] = await pool.query(
    `SELECT user_id, role, name, email, phone, about_me, city, country, languages, gender, profile_picture, created_at
     FROM users
     WHERE user_id = ?`,
    [user_id]
  );
  res.json(rows[0]);
});

export default router;