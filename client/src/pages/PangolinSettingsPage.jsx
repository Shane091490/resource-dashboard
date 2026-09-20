import { useEffect, useState } from "react";
import { api } from "../api.js";
import ToggleSwitch from "../components/ToggleSwitch.jsx";

const empty = { baseUrl: "", apiKey: "", orgId: "" };

function formatSyncedAt(value) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

export default function PangolinSettingsPage({ navigate, showToast }) {
  const [form, setForm] = useState(empty);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  function applySettings(settings) {
    setForm({ baseUrl: settings.baseUrl || "", apiKey: "", orgId: settings.orgId || "" });
    setHasApiKey(settings.hasApiKey);
    setAutoSyncEnabled(settings.autoSyncEnabled);
    setLastSyncedAt(settings.lastSyncedAt);
  }

  useEffect(() => {
    api
      .getPangolinSettings()
      .then(({ settings }) => applySettings(settings))
      .catch((err) => showToast(err.message))
      .finally(() => setLoaded(true));
  }, [showToast]);

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const { settings } = await api.savePangolinSettings(form);
      applySettings(settings);
      showToast("Pangolin connection saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleImportNow() {
    setError("");
    setImporting(true);
    try {
      const result = await api.importPangolinResources();
      showToast(`Imported ${result.imported} new resource${result.imported === 1 ? "" : "s"} (${result.skipped} already present).`);
      const { settings } = await api.getPangolinSettings();
      applySettings(settings);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  async function handleToggleAutoSync(next) {
    setError("");
    try {
      const { settings } = await api.setPangolinAutoSync(next);
      applySettings(settings);
      showToast(next ? "Auto-sync enabled." : "Auto-sync disabled.");
    } catch (err) {
      showToast(err.message);
    }
  }

  const canImport = hasApiKey && !!form.baseUrl;

  return (
    <div className="app-shell">
      <header className="settings-header">
        <button type="button" className="back-btn" onClick={() => navigate("/settings")} aria-label="Back to settings">
          ←
        </button>
        <h1>Pangolin import</h1>
      </header>

      <main className="settings-main">
        <section className="settings-section">
          <div className="settings-warning" role="note">
            <span aria-hidden="true">⚠️</span>
            <span>
              Pangolin's Integration API is disabled by default and isn't exposed alongside the main Pangolin dashboard - it has to be
              turned on in your Pangolin server's config and given its own reachable route (e.g. through a reverse proxy) before this
              page can connect to it. See{" "}
              <a href="https://docs.pangolin.net/manage/integration-api" target="_blank" rel="noopener noreferrer">
                Pangolin's Integration API documentation
              </a>{" "}
              for how to enable and expose it.
            </span>
          </div>
          <p className="settings-hint">
            Connect to your Pangolin Integration API to pull in every public resource as a resource card on your home page. Each one is
            sorted into a category guessed from its name (e.g. "Media Servers", "Networking Tools") - anything unrecognized lands in a
            "General" category instead.
          </p>

          {!loaded ? (
            <div className="page-loading">
              <div className="spinner" />
            </div>
          ) : (
            <form onSubmit={handleSave}>
              <label className="field">
                <span>Pangolin API base URL</span>
                <input
                  type="url"
                  placeholder="https://api.example.com/v1"
                  value={form.baseUrl}
                  onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                  required
                />
              </label>
              <label className="field">
                <span>API key</span>
                <input
                  type="password"
                  placeholder={hasApiKey ? "Unchanged (leave blank to keep current key)" : ""}
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Org ID (optional)</span>
                <input
                  type="text"
                  placeholder="Leave blank to auto-detect"
                  value={form.orgId}
                  onChange={(e) => setForm({ ...form, orgId: e.target.value })}
                />
              </label>

              {error ? <div className="field-error">{error}</div> : null}
              <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save connection"}
                </button>
                <button type="button" className="btn" onClick={handleImportNow} disabled={!canImport || importing}>
                  {importing ? "Importing..." : "Import now"}
                </button>
              </div>
            </form>
          )}
        </section>

        {loaded ? (
          <section className="settings-section">
            <h2>Auto-sync</h2>
            <label className="settings-toggle-row">
              <span>
                <strong>Automatically add new Pangolin resources</strong>
                <div className="settings-hint">
                  Checks Pangolin every few minutes and adds any newly created public resources to the dashboard. Last checked:{" "}
                  {formatSyncedAt(lastSyncedAt)}.
                </div>
              </span>
              <ToggleSwitch
                checked={autoSyncEnabled}
                onChange={handleToggleAutoSync}
                disabled={!canImport}
                ariaLabel="Automatically add new Pangolin resources"
              />
            </label>
          </section>
        ) : null}
      </main>
    </div>
  );
}
