import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool, getAppSettings } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { getPublicSettings, saveSettings } from "../oidc.js";
import { validateNewUserFields } from "../validation.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/users", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, email, first_name, last_name, is_admin, created_at, (oidc_sub IS NOT NULL) AS is_sso
     FROM users ORDER BY created_at ASC`
  );
  res.json({ users: rows });
});

router.post("/users", async (req, res) => {
  const result = validateNewUserFields(req.body || {});
  if (result.error) return res.status(400).json({ error: result.error });
  const { email, firstName, lastName, password } = result;
  const isAdmin = !!(req.body || {}).is_admin;

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await pool.query(
      "INSERT INTO users (email, first_name, last_name, password_hash, is_admin) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, first_name, last_name, is_admin, created_at",
      [email, firstName, lastName, passwordHash, isAdmin]
    );
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "An account with that email already exists" });
    }
    throw err;
  }
});

router.put("/users/:id", async (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) {
    return res.status(400).json({ error: "You cannot change your own role" });
  }
  const { is_admin } = req.body || {};
  if (typeof is_admin !== "boolean") return res.status(400).json({ error: "is_admin must be true or false" });

  const { rows } = await pool.query(
    "UPDATE users SET is_admin = $1 WHERE id = $2 RETURNING id, email, first_name, last_name, is_admin, created_at",
    [is_admin, targetId]
  );
  if (!rows[0]) return res.status(404).json({ error: "User not found" });
  res.json({ user: rows[0] });
});

router.post("/users/:id/reset-password", async (req, res) => {
  const { password } = req.body || {};
  if (!password || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id", [
    passwordHash,
    req.params.id,
  ]);
  if (!rows[0]) return res.status(404).json({ error: "User not found" });
  res.status(204).end();
});

router.delete("/users/:id", async (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }
  const { rowCount } = await pool.query("DELETE FROM users WHERE id = $1", [targetId]);
  if (!rowCount) return res.status(404).json({ error: "User not found" });
  res.status(204).end();
});

router.get("/app-settings", async (req, res) => {
  const settings = await getAppSettings();
  res.json({
    allowRegistration: settings.allow_registration,
    dashboardTitle: settings.dashboard_title,
    dashboardIcon: settings.dashboard_icon,
  });
});

router.put("/app-settings", async (req, res) => {
  const { allowRegistration, dashboardTitle, dashboardIcon } = req.body || {};
  if (allowRegistration === undefined && dashboardTitle === undefined && dashboardIcon === undefined) {
    return res.status(400).json({ error: "Nothing to update" });
  }
  if (allowRegistration !== undefined && typeof allowRegistration !== "boolean") {
    return res.status(400).json({ error: "allowRegistration must be true or false" });
  }
  if (dashboardTitle !== undefined && !String(dashboardTitle).trim()) {
    return res.status(400).json({ error: "Dashboard title cannot be empty" });
  }
  if (dashboardIcon !== undefined && typeof dashboardIcon !== "string") {
    return res.status(400).json({ error: "dashboardIcon must be a string" });
  }

  const current = await getAppSettings();
  const nextAllow = allowRegistration !== undefined ? allowRegistration : current.allow_registration;
  const nextTitle = dashboardTitle !== undefined ? String(dashboardTitle).trim().slice(0, 60) : current.dashboard_title;
  const nextIcon = dashboardIcon !== undefined ? dashboardIcon.trim().slice(0, 16) : current.dashboard_icon;

  await pool.query(
    `INSERT INTO app_settings (id, allow_registration, dashboard_title, dashboard_icon) VALUES (1, $1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET allow_registration = EXCLUDED.allow_registration, dashboard_title = EXCLUDED.dashboard_title, dashboard_icon = EXCLUDED.dashboard_icon`,
    [nextAllow, nextTitle, nextIcon]
  );
  res.json({ allowRegistration: nextAllow, dashboardTitle: nextTitle, dashboardIcon: nextIcon });
});

router.get("/oidc", (req, res) => {
  res.json({ settings: getPublicSettings() });
});

router.put("/oidc", async (req, res) => {
  const { enabled, providerName, issuerUrl, clientId, clientSecret, redirectUri, scopes } = req.body || {};

  const current = getPublicSettings();
  if (enabled) {
    if (!issuerUrl || !clientId || !redirectUri) {
      return res.status(400).json({ error: "Issuer URL, Client ID, and Redirect URI are required to enable SSO" });
    }
    if (!clientSecret && !current.hasClientSecret) {
      return res.status(400).json({ error: "Client Secret is required to enable SSO" });
    }
  }

  const result = await saveSettings({ enabled: !!enabled, providerName, issuerUrl, clientId, clientSecret, redirectUri, scopes });
  if (enabled && !result.ok) {
    return res.status(400).json({ error: `Saved, but could not connect to the identity provider: ${result.error}` });
  }
  res.json({ settings: getPublicSettings() });
});

export default router;
