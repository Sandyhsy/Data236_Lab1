const { createProxyMiddleware } = require("http-proxy-middleware");

/**
 * Proxy /api requests from the CRA dev server to the Express backend so the
 * frontend can hit http://localhost:3000/api/... during development.
 */
module.exports = function proxy(app) {
  const target = process.env.REACT_APP_BACKEND_URL || "http://localhost:4000";

  app.use(
    "/api",
    createProxyMiddleware({
      target,
      changeOrigin: true,
      secure: false,
    })
  );
};

