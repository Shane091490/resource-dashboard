const METADATA_URL = "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/metadata.json";
const CDN_BASE = "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons";
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

let index = null; // Map<normalizedName, directImageUrl>
let loadedAt = 0;
let loadingPromise = null;

function normalize(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
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

    for (const name of [slug, ...(meta.aliases || [])]) {
      const key = normalize(name);
      if (key && !next.has(key)) next.set(key, url);
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

export async function lookupIcon(name) {
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
