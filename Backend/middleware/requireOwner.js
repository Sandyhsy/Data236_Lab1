// Minimal session guard that ensures the user is an authenticated owner
export function requireOwner(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  if (req.session.user.role !== "owner") {
    return res.status(403).json({ error: "Owner role required" });
  }
  next();
}
