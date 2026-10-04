import { pool } from "./db.js";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const CONCURRENCY = 5;
const TIMEOUT_MS = 6000;

// A resource counts as "up" whenever the server answers at all, even with an auth wall (401/403)
// or a redirect - this is a reachability check, not a login check. Only a missing response
// (timeout, DNS failure, connection refused) or a 5xx counts as down.
async function isReachable(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let res = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
    }
    return res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function runWithConcurrency(items, worker, concurrency) {
  let next = 0;
  async function lane() {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane));
}

export async function checkAllResources() {
  const { rows } = await pool.query("SELECT id, url FROM resources");
  await runWithConcurrency(
    rows,
    async (r) => {
      const ok = await isReachable(r.url);
      await pool.query("UPDATE resources SET last_check_ok = $1, last_checked_at = now() WHERE id = $2", [ok, r.id]);
    },
    CONCURRENCY
  );
}

let timer = null;

export function startUptimeCheckLoop() {
  if (timer) return;
  checkAllResources().catch((err) => console.error("Uptime check failed:", err.message));
  timer = setInterval(() => {
    checkAllResources().catch((err) => console.error("Uptime check failed:", err.message));
  }, CHECK_INTERVAL_MS);
}
