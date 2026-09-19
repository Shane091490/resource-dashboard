import { useEffect, useRef, useState } from "react";
import { api, downloadExport } from "../api.js";
import ConfirmDialog from "../components/ConfirmDialog.jsx";

export default function SettingsPage({ navigate, showToast }) {
  const [allowRegistration, setAllowRegistration] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    api
      .getAppSettings()
      .then((s) => setAllowRegistration(s.allowRegistration))
      .catch((err) => showToast(err.message))
      .finally(() => setLoaded(true));
  }, [showToast]);

  async function toggleRegistration() {
    const next = !allowRegistration;
    setSaving(true);
    try {
      await api.saveAppSettings({ allowRegistration: next });
      setAllowRegistration(next);
    } catch (err) {
      showToast(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        setPendingImport(data);
      } catch {
        showToast("That file isn't valid JSON.");
      }
    };
    reader.readAsText(file);
  }

  async function confirmImport() {
    const data = pendingImport;
    setPendingImport(null);
    try {
      const { imported } = await api.importData(data);
      showToast(`Imported ${imported.pages} pages, ${imported.categories} categories, ${imported.resources} resources.`);
    } catch (err) {
      showToast(err.message);
    }
  }

  return (
    <div className="app-shell">
      <header className="settings-header">
        <button type="button" className="back-btn" onClick={() => navigate("/")} aria-label="Back to dashboard">
          ←
        </button>
        <h1>Settings</h1>
      </header>

      <main className="settings-main">
        <section className="settings-section">
          <h2>General</h2>
          <label className="settings-toggle-row">
            <span>
              <strong>Allow new user registration</strong>
              <div className="settings-hint">When off, only an admin can create new accounts.</div>
            </span>
            <input type="checkbox" checked={allowRegistration} onChange={toggleRegistration} disabled={!loaded || saving} />
          </label>
        </section>

        <section className="settings-section">
          <h2>Users</h2>
          <p className="settings-hint">Create accounts, change roles, and reset passwords.</p>
          <button type="button" className="btn" onClick={() => navigate("/settings/users")}>
            Manage users
          </button>
        </section>

        <section className="settings-section">
          <h2>Single sign-on</h2>
          <p className="settings-hint">Connect an OIDC provider such as Keycloak.</p>
          <button type="button" className="btn" onClick={() => navigate("/settings/oidc")}>
            Configure SSO
          </button>
        </section>

        <section className="settings-section">
          <h2>Import / export</h2>
          <p className="settings-hint">Export all pages, categories, and resources as a JSON file, or restore from a previous export.</p>
          <div className="settings-actions-row">
            <button type="button" className="btn" onClick={downloadExport}>
              Export data
            </button>
            <button type="button" className="btn" onClick={() => fileInputRef.current?.click()}>
              Import data
            </button>
            <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleFileChosen} />
          </div>
        </section>
      </main>

      {pendingImport ? (
        <ConfirmDialog
          title="Overwrite all dashboard data?"
          message="Importing will permanently replace every page, category, and resource with the contents of this file. This cannot be undone."
          confirmLabel="Import and overwrite"
          danger
          onConfirm={confirmImport}
          onCancel={() => setPendingImport(null)}
        />
      ) : null}
    </div>
  );
}
