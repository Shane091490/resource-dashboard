import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { deleteImageFile } from "../uploads.js";
import { ignoreUrlsOnDelete } from "../pangolin.js";

const router = Router();
router.use(requireAuth, requireAdmin);

// Every category across every page, for the "move to..." pickers in the resource and category
// modals - admin-only, so it's fine that this bypasses the per-page admin_only visibility filter
// applied to regular users on the dashboard endpoint.
router.get("/", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.page_id, p.name AS page_name
     FROM categories c JOIN pages p ON p.id = c.page_id
     ORDER BY p.position ASC, p.id ASC, c.position ASC, c.id ASC`
  );
  res.json({ categories: rows });
});

router.post("/", async (req, res) => {
  const { name, image, page_id, admin_only } = req.body || {};
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
    "INSERT INTO categories (page_id, name, image, position, admin_only) VALUES ($1, $2, $3, $4, $5) RETURNING id, page_id, name, image, position, admin_only",
    [pageId, cleanName, image || null, posRows[0].next, !!admin_only]
  );
  res.status(201).json({ category: { ...rows[0], resources: [] } });
});

// Registered before "/:id" so the literal path "/reorder" isn't swallowed by it (see resources.js).
router.put("/reorder", async (req, res) => {
  const { page_id, order } = req.body || {};
  const pageId = Number(page_id);
  if (!pageId || !Array.isArray(order) || !order.length) {
    return res.status(400).json({ error: "page_id and a non-empty order array are required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < order.length; i++) {
      await client.query("UPDATE categories SET position = $1 WHERE id = $2 AND page_id = $3", [
        i,
        Number(order[i]),
        pageId,
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
  const { name, image, admin_only, page_id } = req.body || {};

  const { rows: existingRows } = await pool.query("SELECT * FROM categories WHERE id = $1", [id]);
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: "Category not found" });

  const nextName = name !== undefined ? String(name).trim() : existing.name;
  if (!nextName) return res.status(400).json({ error: "Name is required" });
  const nextImage = image !== undefined ? image || null : existing.image;
  const nextAdminOnly = admin_only !== undefined ? !!admin_only : existing.admin_only;

  let nextPageId = existing.page_id;
  let nextPosition = existing.position;
  if (page_id !== undefined && Number(page_id) !== existing.page_id) {
    nextPageId = Number(page_id);
    const { rows: pageRows } = await pool.query("SELECT id FROM pages WHERE id = $1", [nextPageId]);
    if (!pageRows[0]) return res.status(400).json({ error: "Page not found" });
    const { rows: posRows } = await pool.query(
      "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM categories WHERE page_id = $1",
      [nextPageId]
    );
    nextPosition = posRows[0].next;
  }

  const { rows } = await pool.query(
    `UPDATE categories SET name = $1, image = $2, admin_only = $3, page_id = $4, position = $5, updated_at = now()
     WHERE id = $6 RETURNING id, page_id, name, image, position, admin_only`,
    [nextName, nextImage, nextAdminOnly, nextPageId, nextPosition, id]
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
  const { rows: resourceRows } = await pool.query("SELECT url FROM resources WHERE category_id = $1", [id]);
  const { rowCount } = await pool.query("DELETE FROM categories WHERE id = $1", [id]);
  if (!rowCount) return res.status(404).json({ error: "Category not found" });
  imgRows.forEach((r) => deleteImageFile(r.image));
  await ignoreUrlsOnDelete(resourceRows.map((r) => r.url));
  res.status(204).end();
});

export default router;
