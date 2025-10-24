// db.js
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

function required(name) {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing required env: ${name}`);
  }
  return v;
}

const DB_HOST = required("DB_HOST");
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = required("DB_USER");
const DB_PASSWORD = required("DB_PASSWORD");
const DB_NAME = required("DB_NAME");

export const pool = await mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// quick sanity check on startup
try {
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
  console.log(
    `[DB] Connected to ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME} (password: YES)`
  );
} catch (e) {
  console.error("[DB] Connection FAILED:", e.message);
  throw e;
}
