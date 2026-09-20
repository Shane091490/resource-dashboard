import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.PGHOST || "db",
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || "dashboard",
  password: process.env.PGPASSWORD || "dashboard",
  database: process.env.PGDATABASE || "dashboard",
});

export async function waitForDb(retries = 30, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

export async function migrate() {
  await pool.query("ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS dashboard_title TEXT NOT NULL DEFAULT 'Dashboard'");
  await pool.query("ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS dashboard_icon TEXT NOT NULL DEFAULT '🚀'");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'system'");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pangolin_settings (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      base_url TEXT,
      api_key_enc TEXT,
      org_id TEXT,
      auto_sync_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      last_synced_at TIMESTAMPTZ
    )
  `);
}

export async function getAppSettings() {
  const { rows } = await pool.query("SELECT allow_registration, dashboard_title, dashboard_icon FROM app_settings WHERE id = 1");
  return rows[0] || { allow_registration: true, dashboard_title: "Dashboard", dashboard_icon: "🚀" };
}

export async function countUsers() {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM users");
  return rows[0].count;
}
