import { Router } from "express";
import { pool } from "../db.js";
import { requireOwner } from "../middleware/requireOwner.js";

const router = Router();

// POST /api/properties - create a property
router.post("/", requireOwner, async (req, res) => {
  const { user_id } = req.session.user;
  const {
    name, type, description, location, amenities,
    price_per_night, bedrooms, bathrooms,
    availability_start, availability_end
  } = req.body;

  if (!name) return res.status(400).json({ error: "Name is required" });

  const [result] = await pool.query(
    `INSERT INTO properties
     (owner_id, name, type, description, location, amenities, price_per_night, bedrooms, bathrooms, availability_start, availability_end)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user_id, name || "", type || null, description || null, location || null, amenities || null,
      price_per_night || null, bedrooms || null, bathrooms || null, availability_start || null, availability_end || null
    ]
  );
  const [rows] = await pool.query("SELECT * FROM properties WHERE property_id = ?", [result.insertId]);
  res.status(201).json(rows[0]);
});

// GET /api/properties/mine - list my properties (include first image only)
router.get("/mine", requireOwner, async (req, res) => {
  const { user_id } = req.session.user;

  // select each property plus its first image url (ordered by image_id)
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
    WHERE p.owner_id = ?
    ORDER BY p.created_at DESC
    `,
    [user_id]
  );

  res.json(rows);
});

// PUT /api/properties/:id - update if owned
router.put("/:id", requireOwner, async (req, res) => {
  const { user_id } = req.session.user;
  const { id } = req.params;
  const {
    name, type, description, location, amenities,
    price_per_night, bedrooms, bathrooms,
    availability_start, availability_end
  } = req.body;

  const [owned] = await pool.query("SELECT property_id FROM properties WHERE property_id = ? AND owner_id = ?", [id, user_id]);
  if (owned.length === 0) return res.status(404).json({ error: "Property not found" });

  await pool.query(
    `UPDATE properties SET
      name = COALESCE(?, name),
      type = COALESCE(?, type),
      description = COALESCE(?, description),
      location = COALESCE(?, location),
      amenities = COALESCE(?, amenities),
      price_per_night = COALESCE(?, price_per_night),
      bedrooms = COALESCE(?, bedrooms),
      bathrooms = COALESCE(?, bathrooms),
      availability_start = COALESCE(?, availability_start),
      availability_end = COALESCE(?, availability_end)
     WHERE property_id = ?`,
    [name, type, description, location, amenities, price_per_night, bedrooms, bathrooms, availability_start, availability_end, id]
  );

  const [rows] = await pool.query("SELECT * FROM properties WHERE property_id = ?", [id]);
  res.json(rows[0]);
});

// DELETE /api/properties/:id - delete if owned
router.delete("/:id", requireOwner, async (req, res) => {
  const { user_id } = req.session.user;
  const { id } = req.params;
  const [owned] = await pool.query("SELECT property_id FROM properties WHERE property_id = ? AND owner_id = ?", [id, user_id]);
  if (owned.length === 0) return res.status(404).json({ error: "Property not found" });

  await pool.query("DELETE FROM properties WHERE property_id = ?", [id]);
  res.json({ message: "Property deleted" });
});

// GET /api/properties/:id/images - list images for my property
router.get("/:id/images", requireOwner, async (req, res) => {
  const { user_id } = req.session.user;
  const { id } = req.params;

  // Verify ownership
  const [owns] = await pool.query(
    "SELECT property_id FROM properties WHERE property_id = ? AND owner_id = ?",
    [id, user_id]
  );
  if (owns.length === 0) return res.status(404).json({ error: "Property not found" });

  const [rows] = await pool.query(
    "SELECT image_id, url, created_at FROM property_images WHERE property_id = ? ORDER BY image_id ASC",
    [id]
  );
  res.json(rows);
});

router.get("/:id", async (req,res) => {
  const { id } = req.params;
  const [rows] = await pool.query("SELECT * FROM properties WHERE property_id = ?", [id]);
  if (rows.length === 0) return res.status(404).json({ error: "Property not found" });
  res.json(rows[0]);
});

// PUT /api/properties/:id/images - replace images for my property
router.put("/:id/images", requireOwner, async (req, res) => {
  const { user_id } = req.session.user;
  const { id } = req.params;
  const { urls } = req.body;

  if (!Array.isArray(urls)) {
    return res.status(400).json({ error: "urls must be an array of strings" });
  }

  // Verify ownership
  const [owns] = await pool.query(
    "SELECT property_id FROM properties WHERE property_id = ? AND owner_id = ?",
    [id, user_id]
  );
  if (owns.length === 0) return res.status(404).json({ error: "Property not found" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM property_images WHERE property_id = ?", [id]);

    if (urls.length > 0) {
      const values = urls.map(u => [id, u]);
      await conn.query(
        "INSERT INTO property_images (property_id, url) VALUES ?",
        [values]
      );
    }

    await conn.commit();

    const [rows] = await pool.query(
      "SELECT image_id, url, created_at FROM property_images WHERE property_id = ? ORDER BY image_id ASC",
      [id]
    );
    res.json(rows);
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: "Failed to update images" });
  } finally {
    conn.release();
  }
});

export default router;
