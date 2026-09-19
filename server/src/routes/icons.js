import { Router } from "express";
import { requireAuth, requireAdmin } from "../auth.js";
import { lookupIcon } from "../icons.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/lookup", async (req, res) => {
  const name = String(req.query.name || "").trim();
  const url = name ? await lookupIcon(name) : null;
  res.json({ url });
});

export default router;
