import { pool } from "./db.js";
import { encryptSecret, decryptSecret } from "./crypto.js";
import { lookupIcon } from "./icons.js";

const SECRET_PURPOSE = "resource-dashboard-pangolin-secret";
const CATEGORY_NAME = "General";
const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const MAX_PAGES = 20;
const PAGE_SIZE = 100;

let cachedSettings = null;

export async function loadPangolinSettings() {
  const { rows } = await pool.query("SELECT * FROM pangolin_settings WHERE id = 1");
  cachedSettings = rows[0] || null;
  return cachedSettings;
}

export function getPublicPangolinSettings() {
  const s = cachedSettings;
  return {
    baseUrl: s?.base_url || "",
    orgId: s?.org_id || "",
    hasApiKey: !!s?.api_key_enc,
    autoSyncEnabled: !!s?.auto_sync_enabled,
    lastSyncedAt: s?.last_synced_at || null,
  };
}

export async function savePangolinConnection({ baseUrl, apiKey, orgId }) {
  const existing = cachedSettings || (await loadPangolinSettings());
  const keyEnc = apiKey ? encryptSecret(apiKey, SECRET_PURPOSE) : existing?.api_key_enc || null;
  const nextBaseUrl = baseUrl !== undefined ? String(baseUrl).trim().replace(/\/+$/, "") : existing?.base_url || "";
  const nextOrgId = orgId !== undefined ? String(orgId).trim() : existing?.org_id || "";

  const { rows } = await pool.query(
    `INSERT INTO pangolin_settings (id, base_url, api_key_enc, org_id)
     VALUES (1, $1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET base_url = EXCLUDED.base_url, api_key_enc = EXCLUDED.api_key_enc, org_id = EXCLUDED.org_id
     RETURNING *`,
    [nextBaseUrl, keyEnc, nextOrgId]
  );
  cachedSettings = rows[0];
  return getPublicPangolinSettings();
}

export async function setAutoSyncEnabled(enabled) {
  const { rows } = await pool.query("UPDATE pangolin_settings SET auto_sync_enabled = $1 WHERE id = 1 RETURNING *", [!!enabled]);
  cachedSettings = rows[0] || cachedSettings;
  return getPublicPangolinSettings();
}

async function pangolinFetch(baseUrl, apiKey, path) {
  let res;
  try {
    res = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${apiKey}` } });
  } catch (err) {
    throw new Error(`Could not reach the Pangolin API: ${err.message}`);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    throw new Error(body?.message || `Pangolin API request failed (${res.status})`);
  }
  return body.data;
}

async function resolveOrgId(baseUrl, apiKey, orgId) {
  if (orgId) return orgId;
  const data = await pangolinFetch(baseUrl, apiKey, "/orgs");
  const orgs = data?.orgs || [];
  if (orgs.length === 1) return orgs[0].orgId;
  if (!orgs.length) throw new Error("No organizations were found for this API key");
  throw new Error("This API key has access to multiple organizations - set an Org ID to pick one");
}

async function fetchAllPublicResources(baseUrl, apiKey, orgId) {
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await pangolinFetch(baseUrl, apiKey, `/org/${encodeURIComponent(orgId)}/public-resources?pageSize=${PAGE_SIZE}&page=${page}`);
    const resources = data?.resources || [];
    all.push(...resources);
    if (resources.length < PAGE_SIZE) break;
  }
  return all;
}

async function ensureGeneralCategory(client) {
  const { rows: homeRows } = await client.query("SELECT id FROM pages WHERE is_home = TRUE LIMIT 1");
  const pageId = homeRows[0]?.id;
  if (!pageId) throw new Error("No home page exists to import into");

  const { rows: catRows } = await client.query("SELECT id FROM categories WHERE page_id = $1 AND name = $2 LIMIT 1", [
    pageId,
    CATEGORY_NAME,
  ]);
  if (catRows[0]) return catRows[0].id;

  const { rows: posRows } = await client.query("SELECT COALESCE(MAX(position), -1) + 1 AS next FROM categories WHERE page_id = $1", [
    pageId,
  ]);
  const { rows } = await client.query("INSERT INTO categories (page_id, name, position) VALUES ($1, $2, $3) RETURNING id", [
    pageId,
    CATEGORY_NAME,
    posRows[0].next,
  ]);
  return rows[0].id;
}

export async function runPangolinImport() {
  const settings = cachedSettings || (await loadPangolinSettings());
  if (!settings?.base_url || !settings?.api_key_enc) {
    throw new Error("Pangolin connection is not configured");
  }
  const apiKey = decryptSecret(settings.api_key_enc, SECRET_PURPOSE);
  const orgId = await resolveOrgId(settings.base_url, apiKey, settings.org_id);
  const resources = await fetchAllPublicResources(settings.base_url, apiKey, orgId);

  const client = await pool.connect();
  let imported = 0;
  let skipped = 0;
  try {
    await client.query("BEGIN");
    const categoryId = await ensureGeneralCategory(client);
    const { rows: existing } = await client.query("SELECT url FROM resources WHERE category_id = $1", [categoryId]);
    const existingUrls = new Set(existing.map((r) => r.url));

    const { rows: posRows } = await client.query(
      "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM resources WHERE category_id = $1",
      [categoryId]
    );
    let nextPosition = posRows[0].next;

    for (const r of resources) {
      if (!r.fullDomain) {
        skipped += 1;
        continue;
      }
      const url = `${r.ssl === false ? "http" : "https"}://${r.fullDomain}`;
      if (existingUrls.has(url)) {
        skipped += 1;
        continue;
      }
      const image = await lookupIcon(r.name).catch(() => null);
      await client.query(
        `INSERT INTO resources (category_id, name, description, image, url, tags, position)
         VALUES ($1, $2, '', $3, $4, $5, $6)`,
        [categoryId, r.name, image, url, ["pangolin"], nextPosition]
      );
      existingUrls.add(url);
      nextPosition += 1;
      imported += 1;
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  await pool.query("UPDATE pangolin_settings SET last_synced_at = now() WHERE id = 1");
  await loadPangolinSettings();
  return { imported, skipped, total: resources.length };
}

let syncTimer = null;

export function startPangolinAutoSyncLoop() {
  if (syncTimer) return;
  syncTimer = setInterval(async () => {
    try {
      const settings = await loadPangolinSettings();
      if (!settings?.auto_sync_enabled) return;
      const result = await runPangolinImport();
      if (result.imported > 0) console.log(`Pangolin auto-sync: added ${result.imported} new resource(s)`);
    } catch (err) {
      console.error("Pangolin auto-sync failed:", err.message);
    }
  }, SYNC_INTERVAL_MS);
}
