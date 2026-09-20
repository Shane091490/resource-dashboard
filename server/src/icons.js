const METADATA_URL = "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/metadata.json";
const CDN_BASE = "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons";
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

let index = null; // Map<normalizedName, { url, category }>
let loadedAt = 0;
let loadingPromise = null;

function normalize(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// dashboardicons.com's raw category tags are inconsistently cased and hyphenated
// (e.g. "Media-Servers", "network", "E-commerce-Platforms"). Turn them into a clean,
// human-friendly label suitable for a dashboard category name.
function formatCategoryName(raw) {
  return raw
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => (/^[A-Z0-9]+$/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join(" ");
}

async function loadIndex() {
  const res = await fetch(METADATA_URL);
  if (!res.ok) throw new Error(`dashboardicons.com metadata fetch failed: ${res.status}`);
  const data = await res.json();

  const next = new Map();
  for (const [slug, meta] of Object.entries(data)) {
    const ext = meta.base === "png" ? "png" : "svg";
    // Icons with light/dark variants have no plain "<slug>.<ext>" file - only "<slug>-light"/"<slug>-dark".
    const filename = meta.colors ? meta.colors.light || meta.colors.dark || slug : slug;
    const url = `${CDN_BASE}/${ext}/${filename}.${ext}`;
    const category = meta.categories?.[0] ? formatCategoryName(meta.categories[0]) : null;

    for (const name of [slug, ...(meta.aliases || [])]) {
      const key = normalize(name);
      if (key && !next.has(key)) next.set(key, { url, category });
    }
  }
  index = next;
  loadedAt = Date.now();
}

async function ensureIndex() {
  if (index && Date.now() - loadedAt < REFRESH_INTERVAL_MS) return;
  if (!loadingPromise) {
    loadingPromise = loadIndex().finally(() => {
      loadingPromise = null;
    });
  }
  await loadingPromise;
}

// Fire-and-forget warm-up so the first real lookup (an admin adding a resource) isn't the one
// paying for the ~1MB metadata fetch; failures here are non-fatal, just logged.
export function warmIconIndex() {
  ensureIndex().catch((err) => console.error("Could not warm dashboard-icons index:", err.message));
}

async function lookupEntry(name) {
  const key = normalize(name);
  if (!key) return null;
  try {
    await ensureIndex();
  } catch (err) {
    console.error("dashboard-icons lookup unavailable:", err.message);
    return null;
  }
  return index?.get(key) || null;
}

export async function lookupIcon(name) {
  const entry = await lookupEntry(name);
  return entry?.url || null;
}

// Best-guess category for a resource, based on dashboardicons.com's own tagging of that name.
export async function lookupCategory(name) {
  const entry = await lookupEntry(name);
  return entry?.category || null;
}
