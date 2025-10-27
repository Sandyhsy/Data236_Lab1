import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

router.get("/", async (req, res) => {
  const { user_id } = req.session.user;
  const [rows] = await pool.query(`
  SELECT p.property_id, p.name, p.location, p.price_per_night, p.bedrooms, p.bathrooms, p.amenities, p.description,
  (
    SELECT i.url
    FROM property_images i
    WHERE i.property_id = p.property_id
    ORDER BY i.image_id ASC
    LIMIT 1
  ) AS first_image_url
  FROM favorites f
  LEFT JOIN properties p ON p.property_id = f.property_id
  WHERE f.traveler_id = ?
  ORDER BY f.created_at DESC; 
    `, 
  [user_id]);
  res.json(rows);
});

router.post("/", async (req, res) => {
  const uid = req.session.user.user_id 
  const pid = req.body.property_id
  if (!uid || !pid) return res.status(400).json({ error: "user_id and property_id are required" });


  const[ exists] = await pool.query(
    'select favorite_id from favorites where  traveler_id = ? and property_id =?',
    [uid,pid]
   )

   if (exists.length >0 ){
    await pool.query(
      'delete from favorites where  traveler_id = ? and property_id =?',
    [uid,pid])
    return res.status(201).json({message: "Favorite removed"})
   }
   else
   {
  await pool.query(
    `INSERT INTO favorites (traveler_id, property_id) values
     (?, ?)`,
    [uid, pid]
  )
    return res.status(201).json({message: "Favorite added"})
   }
  
  res.status(500).json({error: "Internal server error"});
});

export default router;
