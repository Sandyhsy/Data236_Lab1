import express from "express";

const router = express.Router();

const RAW_AGENT_URL =
  process.env.AGENT_URL ||
  process.env.REACT_APP_CONCIERGE_URL ||
  "http://127.0.0.1:8001";
const AGENT_URL = (RAW_AGENT_URL || "").replace(/\/$/, "");
const AGENT_AI_BASE = AGENT_URL.endsWith("/ai") ? AGENT_URL : `${AGENT_URL}/ai`;

function buildAgentUrl(pathname, search = "") {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${AGENT_AI_BASE}${normalized}${search}`;
}

async function forwardJson(req, res, target, init = {}) {
  try {
    const response = await fetch(target, init);
    if (response.status === 204 || response.status === 205) {
      res.status(response.status).end();
      return;
    }
    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    if (isJson) {
      const body = await response.json().catch(() => ({}));
      res.status(response.status).json(body);
    } else {
      const body = await response.text();
      res.status(response.status).send(body);
    }
  } catch (err) {
    res.status(502).json({ error: err.message || String(err) });
  }
}

// Proxy all POSTs under /api/ai/* -> agent /ai/*
router.post(/.*/, async (req, res) => {
  const target = buildAgentUrl(req.path);
  await forwardJson(req, res, target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req.body ?? {}),
  });
});

// Proxy GET /api/ai/* -> agent /ai/*
router.get(/.*/, async (req, res) => {
  const search = new URLSearchParams(req.query).toString();
  const target = buildAgentUrl(req.path, search ? `?${search}` : "");
  await forwardJson(req, res, target);
});

export default router;
