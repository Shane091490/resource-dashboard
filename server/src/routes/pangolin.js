import { Router } from "express";
import { requireAuth, requireAdmin } from "../auth.js";
import {
  loadPangolinSettings,
  getPublicPangolinSettings,
  savePangolinConnection,
  setAutoSyncEnabled,
  runPangolinImport,
} from "../pangolin.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/settings", async (req, res) => {
  await loadPangolinSettings();
  res.json({ settings: getPublicPangolinSettings() });
});

router.put("/settings", async (req, res) => {
  const { baseUrl, apiKey, orgId } = req.body || {};
  if (baseUrl !== undefined && !String(baseUrl).trim()) {
    return res.status(400).json({ error: "Base URL cannot be empty" });
  }
  const settings = await savePangolinConnection({ baseUrl, apiKey, orgId });
  res.json({ settings });
});

router.put("/auto-sync", async (req, res) => {
  const { enabled } = req.body || {};
  if (typeof enabled !== "boolean") return res.status(400).json({ error: "enabled must be true or false" });
  await loadPangolinSettings();
  const current = getPublicPangolinSettings();
  if (enabled && (!current.baseUrl || !current.hasApiKey)) {
    return res.status(400).json({ error: "Save your Pangolin connection details first" });
  }
  const settings = await setAutoSyncEnabled(enabled);
  res.json({ settings });
});

router.post("/import", async (req, res) => {
  try {
    const result = await runPangolinImport();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
