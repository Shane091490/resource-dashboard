import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { deleteImageFile } from "../uploads.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.post("/", async (req, res) => {
  const { name, image, page_id } = req.body || {};
  const cleanName = String(name || "").trim();
  const pageId = Number(page_id);
  if (!cleanName) return res.status(400).json({ error: "Name is required" });
  if (!pageId) return res.status(400).json({ error: "A page is required" });

  const { rows: pageRows } = await pool.query("SELECT id FROM pages WHERE id = $1", [pageId]);
  if (!pageRows[0]) return res.status(400).json({ error: "Page not found" });

  const { rows: posRows } = await pool.query(
    "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM categories WHERE page_id = $1",
    [pageId]
  );
  const { rows } = await pool.query(
    "INSERT INTO categories (page_id, name, image, position) VALUES ($1, $2, $3, $4) RETURNING id, page_id, name, image, position",
    [pageId, cleanName, image || null, posRows[0].next]
  );
  res.status(201).json({ category: { ...rows[0], resources: [] } });
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, image } = req.body || {};

  const { rows: existingRows } = await pool.query("SELECT * FROM categories WHERE id = $1", [id]);
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: "Category not found" });

  const nextName = name !== undefined ? String(name).trim() : existing.name;
  if (!nextName) return res.status(400).json({ error: "Name is required" });
  const nextImage = image !== undefined ? image || null : existing.image;

  const { rows } = await pool.query(
    "UPDATE categories SET name = $1, image = $2, updated_at = now() WHERE id = $3 RETURNING id, page_id, name, image, position",
    [nextName, nextImage, id]
  );

  if (image !== undefined && existing.image && existing.image !== nextImage) {
    deleteImageFile(existing.image);
  }

  res.json({ category: rows[0] });
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { rows: imgRows } = await pool.query(
    "SELECT image FROM (SELECT image FROM categories WHERE id = $1 UNION ALL SELECT image FROM resources WHERE category_id = $1) t",
    [id]
  );
  const { rowCount } = await pool.query("DELETE FROM categories WHERE id = $1", [id]);
  if (!rowCount) return res.status(404).json({ error: "Category not found" });
  imgRows.forEach((r) => deleteImageFile(r.image));
  res.status(204).end();
});

export default router;
