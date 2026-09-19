import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { validateResourceFields } from "../validation.js";
import { deleteImageFile } from "../uploads.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.post("/", async (req, res) => {
  const result = validateResourceFields(req.body || {});
  if (result.error) return res.status(400).json({ error: result.error });
  const { name, description, url, tags, categoryId } = result;
  const { image } = req.body || {};

  const { rows: catRows } = await pool.query("SELECT id FROM categories WHERE id = $1", [categoryId]);
  if (!catRows[0]) return res.status(400).json({ error: "Category not found" });

  const { rows: posRows } = await pool.query(
    "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM resources WHERE category_id = $1",
    [categoryId]
  );
  const { rows } = await pool.query(
    `INSERT INTO resources (category_id, name, description, image, url, tags, position)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, category_id, name, description, image, url, tags, position`,
    [categoryId, name, description, image || null, url, tags, posRows[0].next]
  );
  res.status(201).json({ resource: rows[0] });
});

// Sets category_id + position for every resource id in `order`, in one call - covers both a
// plain within-category reorder and a drag-and-drop move to a different category card.
// This must be registered before "/:id" so the literal path "/reorder" isn't swallowed by it.
router.put("/reorder", async (req, res) => {
  const { category_id, order } = req.body || {};
  const categoryId = Number(category_id);
  if (!categoryId || !Array.isArray(order) || !order.length) {
    return res.status(400).json({ error: "category_id and a non-empty order array are required" });
  }

  const { rows: catRows } = await pool.query("SELECT id FROM categories WHERE id = $1", [categoryId]);
  if (!catRows[0]) return res.status(400).json({ error: "Category not found" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < order.length; i++) {
      await client.query("UPDATE resources SET category_id = $1, position = $2 WHERE id = $3", [
        categoryId,
        i,
        Number(order[i]),
      ]);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  res.status(204).end();
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { rows: existingRows } = await pool.query("SELECT * FROM resources WHERE id = $1", [id]);
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: "Resource not found" });

  const body = req.body || {};
  const result = validateResourceFields({
    name: body.name !== undefined ? body.name : existing.name,
    description: body.description !== undefined ? body.description : existing.description,
    url: body.url !== undefined ? body.url : existing.url,
    tags: body.tags !== undefined ? body.tags : existing.tags,
    category_id: existing.category_id,
  });
  if (result.error) return res.status(400).json({ error: result.error });
  const nextImage = body.image !== undefined ? body.image || null : existing.image;

  const { rows } = await pool.query(
    `UPDATE resources SET name = $1, description = $2, url = $3, tags = $4, image = $5, updated_at = now()
     WHERE id = $6 RETURNING id, category_id, name, description, image, url, tags, position`,
    [result.name, result.description, result.url, result.tags, nextImage, id]
  );

  if (body.image !== undefined && existing.image && existing.image !== nextImage) {
    deleteImageFile(existing.image);
  }

  res.json({ resource: rows[0] });
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await pool.query("SELECT image FROM resources WHERE id = $1", [id]);
  if (!rows[0]) return res.status(404).json({ error: "Resource not found" });
  await pool.query("DELETE FROM resources WHERE id = $1", [id]);
  deleteImageFile(rows[0].image);
  res.status(204).end();
});

export default router;
