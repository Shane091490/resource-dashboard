import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { slugify } from "../validation.js";
import { deleteImageFile, imageMimeFromFilename, readImageBase64, writeImageFromBase64 } from "../uploads.js";

const router = Router();
router.use(requireAuth, requireAdmin);

function exportImage(filename) {
  if (!filename) return null;
  if (/^https?:\/\//i.test(filename)) return { url: filename };
  const data = readImageBase64(filename);
  if (!data) return null;
  return { mime: imageMimeFromFilename(filename), data };
}

router.get("/export", async (req, res) => {
  const { rows: pages } = await pool.query("SELECT id, name, slug, position, is_home FROM pages ORDER BY position ASC, id ASC");
  const { rows: categories } = await pool.query("SELECT id, page_id, name, image, position FROM categories ORDER BY page_id ASC, position ASC");
  const { rows: resources } = await pool.query(
    "SELECT id, category_id, name, description, image, url, tags, position FROM resources ORDER BY category_id ASC, position ASC"
  );

  const resourcesByCategory = new Map();
  for (const r of resources) {
    if (!resourcesByCategory.has(r.category_id)) resourcesByCategory.set(r.category_id, []);
    resourcesByCategory.get(r.category_id).push({
      name: r.name,
      description: r.description,
      url: r.url,
      tags: r.tags,
      position: r.position,
      image: exportImage(r.image),
    });
  }

  const categoriesByPage = new Map();
  for (const c of categories) {
    if (!categoriesByPage.has(c.page_id)) categoriesByPage.set(c.page_id, []);
    categoriesByPage.get(c.page_id).push({
      name: c.name,
      position: c.position,
      image: exportImage(c.image),
      resources: resourcesByCategory.get(c.id) || [],
    });
  }

  const pagesOut = pages.map((p) => ({
    name: p.name,
    slug: p.slug,
    position: p.position,
    is_home: p.is_home,
    categories: categoriesByPage.get(p.id) || [],
  }));

  res.setHeader("Content-Disposition", `attachment; filename="resource-dashboard-export.json"`);
  res.json({ version: 1, exported_at: new Date().toISOString(), pages: pagesOut });
});

function importImage(image) {
  if (!image) return null;
  if (image.url) return image.url;
  if (image.data) return writeImageFromBase64(image.mime, image.data);
  return null;
}

router.post("/import", async (req, res) => {
  const { confirm, data } = req.body || {};
  if (!confirm) return res.status(400).json({ error: "Confirmation required" });
  if (!data || !Array.isArray(data.pages)) {
    return res.status(400).json({ error: "Invalid import file" });
  }

  const client = await pool.connect();
  const writtenFiles = [];
  try {
    await client.query("BEGIN");

    const { rows: oldImages } = await client.query(
      "SELECT image FROM categories WHERE image IS NOT NULL UNION ALL SELECT image FROM resources WHERE image IS NOT NULL"
    );

    await client.query("DELETE FROM pages");

    let importedPages = 0;
    let importedCategories = 0;
    let importedResources = 0;
    let sawHome = false;

    for (let pIdx = 0; pIdx < data.pages.length; pIdx++) {
      const p = data.pages[pIdx];
      if (!p || typeof p.name !== "string" || !p.name.trim()) continue;
      const isHome = !!p.is_home && !sawHome;
      if (isHome) sawHome = true;
      const baseSlug = slugify(p.slug || p.name);
      let slug = baseSlug;
      let n = 2;
      for (;;) {
        const { rows } = await client.query("SELECT id FROM pages WHERE slug = $1", [slug]);
        if (!rows.length) break;
        slug = `${baseSlug}-${n++}`;
      }

      const { rows: pageRows } = await client.query(
        "INSERT INTO pages (name, slug, position, is_home) VALUES ($1, $2, $3, $4) RETURNING id",
        [p.name.trim(), slug, pIdx, isHome]
      );
      const pageId = pageRows[0].id;
      importedPages += 1;

      const categories = Array.isArray(p.categories) ? p.categories : [];
      for (let cIdx = 0; cIdx < categories.length; cIdx++) {
        const c = categories[cIdx];
        if (!c || typeof c.name !== "string" || !c.name.trim()) continue;
        const catImage = importImage(c.image);
        if (catImage && !/^https?:\/\//i.test(catImage)) writtenFiles.push(catImage);

        const { rows: catRows } = await client.query(
          "INSERT INTO categories (page_id, name, image, position) VALUES ($1, $2, $3, $4) RETURNING id",
          [pageId, c.name.trim(), catImage, cIdx]
        );
        const categoryId = catRows[0].id;
        importedCategories += 1;

        const resources = Array.isArray(c.resources) ? c.resources : [];
        for (let rIdx = 0; rIdx < resources.length; rIdx++) {
          const r = resources[rIdx];
          if (!r || typeof r.name !== "string" || !r.name.trim() || typeof r.url !== "string" || !r.url.trim()) continue;
          const resImage = importImage(r.image);
          if (resImage && !/^https?:\/\//i.test(resImage)) writtenFiles.push(resImage);
          const tags = Array.isArray(r.tags) ? r.tags.map((t) => String(t).toLowerCase()).slice(0, 25) : [];

          await client.query(
            `INSERT INTO resources (category_id, name, description, image, url, tags, position)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [categoryId, r.name.trim(), r.description || "", resImage, r.url.trim(), tags, rIdx]
          );
          importedResources += 1;
        }
      }
    }

    if (!sawHome) {
      const { rows } = await client.query("SELECT id FROM pages ORDER BY position ASC, id ASC LIMIT 1");
      if (rows[0]) await client.query("UPDATE pages SET is_home = TRUE WHERE id = $1", [rows[0].id]);
    }
    if (importedPages === 0) {
      await client.query(
        "INSERT INTO pages (name, slug, position, is_home) VALUES ('Home', 'home', 0, TRUE) ON CONFLICT (slug) DO NOTHING"
      );
    }

    await client.query("COMMIT");
    oldImages.forEach((r) => deleteImageFile(r.image));
    res.json({ imported: { pages: importedPages, categories: importedCategories, resources: importedResources } });
  } catch (err) {
    writtenFiles.forEach((f) => deleteImageFile(f));
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

router.delete("/wipe", async (req, res) => {
  const { confirm } = req.body || {};
  if (confirm !== "DELETE") return res.status(400).json({ error: 'Confirmation required (send confirm: "DELETE")' });

  const { rows: images } = await pool.query(
    "SELECT image FROM categories WHERE image IS NOT NULL UNION ALL SELECT image FROM resources WHERE image IS NOT NULL"
  );
  await pool.query("DELETE FROM categories");
  images.forEach((r) => deleteImageFile(r.image));
  res.json({ ok: true });
});

export default router;
