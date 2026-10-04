import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { validateResourceFields } from "../validation.js";
import { deleteImageFile } from "../uploads.js";
import { ignoreUrlsOnDelete } from "../pangolin.js";

const router = Router();
router.use(requireAuth);

// Open to any signed-in user (not just admins) so the uptime dot on every resource card can
// refresh itself periodically without granting the viewer access to the mutating routes below.
router.get("/status", async (req, res) => {
  const ids = String(req.query.ids || "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  if (!ids.length) return res.json({ statuses: [] });
  const { rows } = await pool.query(
    "SELECT id, last_check_ok, last_checked_at FROM resources WHERE id = ANY($1)",
    [ids]
  );
  res.json({ statuses: rows });
});

router.post("/", requireAdmin, async (req, res) => {
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
router.put("/reorder", requireAdmin, async (req, res) => {
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

// Moves every listed resource into one target category (any page) in a single call, for the
// edit-mode multi-select "Move to..." bulk action. Must be registered before "/:id".
router.put("/bulk-move", requireAdmin, async (req, res) => {
  const { ids, category_id } = req.body || {};
  const categoryId = Number(category_id);
  const numericIds = Array.isArray(ids) ? ids.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
  if (!numericIds.length || !categoryId) {
    return res.status(400).json({ error: "ids and category_id are required" });
  }

  const { rows: catRows } = await pool.query("SELECT id FROM categories WHERE id = $1", [categoryId]);
  if (!catRows[0]) return res.status(400).json({ error: "Category not found" });

  const { rows: posRows } = await pool.query(
    "SELECT COALESCE(MAX(position), -1) AS max FROM resources WHERE category_id = $1",
    [categoryId]
  );
  let nextPosition = posRows[0].max + 1;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const id of numericIds) {
      await client.query("UPDATE resources SET category_id = $1, position = $2, updated_at = now() WHERE id = $3", [
        categoryId,
        nextPosition++,
        id,
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

// Deletes every listed resource in one call, for the edit-mode multi-select bulk delete action.
// Must be registered before "/:id".
router.delete("/bulk", requireAdmin, async (req, res) => {
  const { ids } = req.body || {};
  const numericIds = Array.isArray(ids) ? ids.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
  if (!numericIds.length) return res.status(400).json({ error: "ids is required" });

  const { rows } = await pool.query("SELECT image, url FROM resources WHERE id = ANY($1)", [numericIds]);
  await pool.query("DELETE FROM resources WHERE id = ANY($1)", [numericIds]);
  rows.forEach((r) => deleteImageFile(r.image));
  await ignoreUrlsOnDelete(rows.map((r) => r.url));
  res.status(204).end();
});

router.put("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { rows: existingRows } = await pool.query("SELECT * FROM resources WHERE id = $1", [id]);
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: "Resource not found" });

  const body = req.body || {};

  let categoryId = existing.category_id;
  if (body.category_id !== undefined && Number(body.category_id) !== existing.category_id) {
    categoryId = Number(body.category_id);
    const { rows: catRows } = await pool.query("SELECT id FROM categories WHERE id = $1", [categoryId]);
    if (!catRows[0]) return res.status(400).json({ error: "Category not found" });
  }

  const result = validateResourceFields({
    name: body.name !== undefined ? body.name : existing.name,
    description: body.description !== undefined ? body.description : existing.description,
    url: body.url !== undefined ? body.url : existing.url,
    tags: body.tags !== undefined ? body.tags : existing.tags,
    category_id: categoryId,
  });
  if (result.error) return res.status(400).json({ error: result.error });
  const nextImage = body.image !== undefined ? body.image || null : existing.image;

  let position = existing.position;
  if (categoryId !== existing.category_id) {
    const { rows: posRows } = await pool.query(
      "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM resources WHERE category_id = $1",
      [categoryId]
    );
    position = posRows[0].next;
  }

  const { rows } = await pool.query(
    `UPDATE resources SET category_id = $1, name = $2, description = $3, url = $4, tags = $5, image = $6, position = $7, updated_at = now()
     WHERE id = $8 RETURNING id, category_id, name, description, image, url, tags, position`,
    [categoryId, result.name, result.description, result.url, result.tags, nextImage, position, id]
  );

  if (body.image !== undefined && existing.image && existing.image !== nextImage) {
    deleteImageFile(existing.image);
  }

  res.json({ resource: rows[0] });
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await pool.query("SELECT image, url FROM resources WHERE id = $1", [id]);
  if (!rows[0]) return res.status(404).json({ error: "Resource not found" });
  await pool.query("DELETE FROM resources WHERE id = $1", [id]);
  deleteImageFile(rows[0].image);
  await ignoreUrlsOnDelete([rows[0].url]);
  res.status(204).end();
});

export default router;
