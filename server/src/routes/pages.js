import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { slugify } from "../validation.js";

const router = Router();
router.use(requireAuth);

async function uniqueSlug(name, excludeId) {
  const base = slugify(name);
  let slug = base;
  let n = 2;
  for (;;) {
    const { rows } = await pool.query(
      excludeId ? "SELECT id FROM pages WHERE slug = $1 AND id != $2" : "SELECT id FROM pages WHERE slug = $1",
      excludeId ? [slug, excludeId] : [slug]
    );
    if (!rows.length) return slug;
    slug = `${base}-${n++}`;
  }
}

router.get("/", async (req, res) => {
  const { rows } = await pool.query("SELECT id, name, slug, position, is_home FROM pages ORDER BY position ASC, id ASC");
  res.json({ pages: rows });
});

router.get("/:id/dashboard", async (req, res) => {
  const pageId = Number(req.params.id);
  const { rows: pageRows } = await pool.query("SELECT id, name, slug, position, is_home FROM pages WHERE id = $1", [pageId]);
  if (!pageRows[0]) return res.status(404).json({ error: "Page not found" });

  const { rows: categories } = await pool.query(
    "SELECT id, page_id, name, image, position FROM categories WHERE page_id = $1 ORDER BY position ASC, id ASC",
    [pageId]
  );
  const categoryIds = categories.map((c) => c.id);
  const { rows: resources } = categoryIds.length
    ? await pool.query(
        `SELECT id, category_id, name, description, image, url, tags, position
         FROM resources WHERE category_id = ANY($1) ORDER BY position ASC, id ASC`,
        [categoryIds]
      )
    : { rows: [] };

  const resourcesByCategory = new Map();
  for (const r of resources) {
    if (!resourcesByCategory.has(r.category_id)) resourcesByCategory.set(r.category_id, []);
    resourcesByCategory.get(r.category_id).push(r);
  }

  res.json({
    page: pageRows[0],
    categories: categories.map((c) => ({ ...c, resources: resourcesByCategory.get(c.id) || [] })),
  });
});

router.post("/", requireAdmin, async (req, res) => {
  const name = String((req.body || {}).name || "").trim();
  if (!name) return res.status(400).json({ error: "Name is required" });

  const slug = await uniqueSlug(name);
  const { rows: posRows } = await pool.query("SELECT COALESCE(MAX(position), -1) + 1 AS next FROM pages");
  const { rows } = await pool.query(
    "INSERT INTO pages (name, slug, position) VALUES ($1, $2, $3) RETURNING id, name, slug, position, is_home",
    [name, slug, posRows[0].next]
  );
  res.status(201).json({ page: rows[0] });
});

router.put("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { name, position } = req.body || {};

  const { rows: existingRows } = await pool.query("SELECT * FROM pages WHERE id = $1", [id]);
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: "Page not found" });

  const nextName = name !== undefined ? String(name).trim() : existing.name;
  if (!nextName) return res.status(400).json({ error: "Name is required" });
  const nextSlug = name !== undefined && nextName !== existing.name ? await uniqueSlug(nextName, id) : existing.slug;
  const nextPosition = position !== undefined ? Number(position) : existing.position;

  const { rows } = await pool.query(
    "UPDATE pages SET name = $1, slug = $2, position = $3 WHERE id = $4 RETURNING id, name, slug, position, is_home",
    [nextName, nextSlug, nextPosition, id]
  );
  res.json({ page: rows[0] });
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await pool.query("SELECT is_home FROM pages WHERE id = $1", [id]);
  if (!rows[0]) return res.status(404).json({ error: "Page not found" });
  if (rows[0].is_home) return res.status(400).json({ error: "The Home page cannot be deleted" });

  await pool.query("DELETE FROM pages WHERE id = $1", [id]);
  res.status(204).end();
});

export default router;
