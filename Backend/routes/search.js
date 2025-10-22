import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

router.get("/", async (req, res) => {
  const { user_id } = req.session.user;
  const [rows] = await pool.query("SELECT * FROM properties ORDER BY created_at DESC");
  res.json(rows);
});


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

export default router;