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
  // Placeholder for future incremental schema changes (init.sql covers the initial schema).
}

export async function getAppSettings() {
  const { rows } = await pool.query("SELECT allow_registration FROM app_settings WHERE id = 1");
  return rows[0] || { allow_registration: true };
}

export async function countUsers() {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM users");
  return rows[0].count;
}
