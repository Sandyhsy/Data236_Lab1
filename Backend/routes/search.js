import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

router.post("/properties", async (req, res) => {
  const { location, start, end, guests } = req.body || {};
  const loc = location ? location.trim() : '';
  const e = end ==''? null: end;
  const s = start ==''? null: start; 
  const [rows] = await pool.query("SELECT * FROM properties where (? = '' or lower(location) like lower(?)) and (? is null or  availability_start<=?) and (? is null or availability_end>=?) and (? is null or bedrooms >= ?) ORDER BY created_at DESC",
    [loc,`%${loc}%`,s, s, e, e,guests ,guests]
  );
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
