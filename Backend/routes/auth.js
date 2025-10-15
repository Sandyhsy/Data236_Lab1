import { Router } from "express";
import bcrypt from "bcrypt";
import { pool } from "../db.js";

const router = Router();

// POST /api/auth/signup (owner)
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, city, country } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const [exists] = await pool.query("SELECT user_id FROM users WHERE email = ?", [email]);
    if (exists.length > 0) {
      return res.status(409).json({ error: "Email already in use" });
    }
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO users (role, name, email, password_hash, city, country)
       VALUES ('owner', ?, ?, ?, ?, ?)`,
      [name, email, hash, city || null, country || null]
    );
    // Start session
    req.session.user = { user_id: result.insertId, role: "owner", name, email };
    res.status(201).json({ message: "Owner created", user: req.session.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Signup failed" });
  }
});

// POST /api/auth/login (owner only)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query(
      "SELECT user_id, role, name, email, password_hash FROM users WHERE email = ? AND role = 'owner'",
      [email]
    );
    if (rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    req.session.user = { user_id: user.user_id, role: user.role, name: user.name, email: user.email };
    res.json({ message: "Logged in", user: req.session.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logged out" });
  });
});

// GET /api/auth/me
router.get("/me", (req, res) => {
  if (!req.session || !req.session.user) return res.status(200).json({ user: null });
  res.json({ user: req.session.user });
});

export default router;
