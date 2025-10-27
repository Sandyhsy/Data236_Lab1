import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

// /api/search/properties
router.post("/properties", async (req, res) => {
  const { location, start, end, guests } = req.body || {};
  const loc = location ? location.trim() : '';
  const s = start === '' ? null : start;
  const e = end === '' ? null : end;

  const sql = `
    SELECT
      p.*,
      (
        SELECT i.url
        FROM property_images i
        WHERE i.property_id = p.property_id
        ORDER BY i.image_id ASC
        LIMIT 1
      ) AS first_image_url
    FROM properties p
    WHERE
      (? = '' OR LOWER(p.location) LIKE LOWER(?))
      AND (? IS NULL OR p.availability_start <= ?)
      AND (? IS NULL OR p.availability_end >= ?)
      AND (? IS NULL OR p.bedrooms >= ?)
    ORDER BY p.created_at DESC
  `;

  const params = [loc, `%${loc}%`, s, s, e, e, guests, guests];
  const [rows] = await pool.query(sql, params);
  res.json(rows);
});



// GET /api/properties - public list for search (includes first image only)
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        p.*,
        (
          SELECT i.url
          FROM property_images i
          WHERE i.property_id = p.property_id
          ORDER BY i.image_id ASC
          LIMIT 1
        ) AS first_image_url
      FROM properties p
      ORDER BY p.created_at DESC
      `
    );
    res.json(rows);
  } catch (err) {
    console.error("[GET /api/properties] error:", err);
    res.status(500).json({ error: "Failed to load properties" });
  }
});



export default router;
