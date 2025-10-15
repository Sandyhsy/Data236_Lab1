import { Router } from "express";
import { pool } from "../db.js";
import { requireOwner } from "../middleware/requireOwner.js";

const router = Router();

// GET /api/properties/:id/images
router.get("/:id/images", requireOwner, async (req, res) => {
  const { id } = req.params;
  const [rows] = await pool.query(
    "SELECT image_id, property_id, url, created_at FROM property_images WHERE property_id = ? ORDER BY image_id ASC",
    [id]
  );
  res.json(rows);
});

// PUT /api/properties/:id/images
// body: { urls: string[] } -> Replace the set of URLs atomically
router.put("/:id/images", requireOwner, async (req, res) => {
  const { id } = req.params;
  const urls = Array.isArray(req.body?.urls) ? req.body.urls : [];
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Read current URLs
    const [current] = await conn.query(
      "SELECT url FROM property_images WHERE property_id = ?",
      [id]
    );
    const currentSet = new Set(current.map(r => r.url));
    const nextSet = new Set(urls);

    // Delete removed
    if (current.length > 0) {
      const toDelete = [...currentSet].filter(u => !nextSet.has(u));
      if (toDelete.length > 0) {
        await conn.query(
          "DELETE FROM property_images WHERE property_id = ? AND url IN (?)",
          [id, toDelete]
        );
      }
    }

    // Insert new
    const toInsert = [...nextSet].filter(u => !currentSet.has(u));
    if (toInsert.length > 0) {
      const values = toInsert.map(u => [id, u]);
      await conn.query(
        "INSERT IGNORE INTO property_images (property_id, url) VALUES ?",
        [values]
      );
    }

    await conn.commit();
    const [rows] = await conn.query(
      "SELECT image_id, property_id, url, created_at FROM property_images WHERE property_id = ? ORDER BY image_id ASC",
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