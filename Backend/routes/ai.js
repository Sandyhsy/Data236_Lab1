import express from "express";

const router = express.Router();

const AGENT_URL = process.env.AGENT_URL || process.env.REACT_APP_CONCIERGE_URL || "http://127.0.0.1:8001";

// Proxy POST /api/ai/chat -> /ai/chat
router.post(["/chat","/concierge"], async (req, res) => {
  try {
    const path = req.path.replace(/\//, "");
    const target = `${AGENT_URL}/ai/${path}`;
    const r = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const body = await r.json().catch(() => ({}));
    res.status(r.status).json(body);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Proxy GET /api/ai/* -> agent
router.get(["/health","/history"], async (req, res) => {
  try {
    const path = req.path.replace(/\//, "");
    const query = new URLSearchParams(req.query).toString();
    const target = `${AGENT_URL}/ai/${path}${query ? `?${query}` : ""}`;
    const r = await fetch(target);
    const body = await r.json().catch(() => ({}));
    res.status(r.status).json(body);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

export default router;
