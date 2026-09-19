import { Router } from "express";
import { requireAuth } from "../auth.js";
import { getAppSettings } from "../db.js";

const router = Router();

// Public (any authenticated user, not just admins) - the dashboard title is shown in the navbar
// for everyone, unlike the rest of app-settings which is admin-only under /api/admin.
router.get("/", requireAuth, async (req, res) => {
  const settings = await getAppSettings();
  res.json({ dashboardTitle: settings.dashboard_title });
});

export default router;
