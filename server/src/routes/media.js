import { Router } from "express";
import { requireAuth, requireAdmin } from "../auth.js";
import { uploadImage } from "../uploads.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.post("/image", uploadImage.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });
  res.status(201).json({ image: req.file.filename });
});

export default router;
