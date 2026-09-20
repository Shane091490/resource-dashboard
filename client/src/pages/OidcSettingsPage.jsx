import { useEffect, useState } from "react";
import { api } from "../api.js";
import ToggleSwitch from "../components/ToggleSwitch.jsx";

const empty = {
  enabled: false,
  providerName: "",
  issuerUrl: "",
  clientId: "",
  clientSecret: "",
  redirectUri: "",
  scopes: "openid email profile",
};

export default function OidcSettingsPage({ navigate, showToast }) {
  const [form, setForm] = useState(empty);
  const [hasClientSecret, setHasClientSecret] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getOidcSettings()
      .then(({ settings }) => {
        setForm({
          enabled: settings.enabled,
          providerName: settings.providerName,
          issuerUrl: settings.issuerUrl,
          clientId: settings.clientId,
          clientSecret: "",
          redirectUri: settings.redirectUri,
          scopes: settings.scopes,
        });
        setHasClientSecret(settings.hasClientSecret);
        setConnected(settings.connected);
      })
      .catch((err) => showToast(err.message))
      .finally(() => setLoaded(true));
  }, [showToast]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const { settings } = await api.saveOidcSettings(form);
      setHasClientSecret(settings.hasClientSecret);
      setConnected(settings.connected);
      setForm((f) => ({ ...f, clientSecret: "" }));
      showToast("SSO settings saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const defaultRedirect = `${window.location.origin}/api/auth/oidc/callback`;

  return (
    <div className="app-shell">
      <header className="settings-header">
        <button type="button" className="back-btn" onClick={() => navigate("/settings")} aria-label="Back to settings">
          ←
        </button>
        <h1>Single sign-on (OIDC)</h1>
      </header>

      <main className="settings-main">
        <section className="settings-section">
          <p className="settings-hint">
            Works with any standards-compliant OIDC provider, including Keycloak. Set the redirect URI in your provider to:
            <br />
            <code className="code-inline">{defaultRedirect}</code>
          </p>

          {!loaded ? (
            <div className="page-loading">
              <div className="spinner" />
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <label className="settings-toggle-row">
                <span>
                  <strong>Enable SSO</strong>
                  <div className="settings-hint">{connected ? "Currently connected." : form.enabled ? "Enabled, but not yet connected." : "Disabled."}</div>
                </span>
                <ToggleSwitch checked={form.enabled} onChange={(val) => setForm({ ...form, enabled: val })} ariaLabel="Enable SSO" />
              </label>

              <label className="field">
                <span>Provider display name</span>
                <input
                  type="text"
                  placeholder="Keycloak"
                  value={form.providerName}
                  onChange={(e) => setForm({ ...form, providerName: e.target.value })}
                  disabled={!form.enabled}
                />
              </label>
              <label className="field">
                <span>Issuer URL</span>
                <input
                  type="url"
                  placeholder="https://login.example.com/realms/myrealm"
                  value={form.issuerUrl}
                  onChange={(e) => setForm({ ...form, issuerUrl: e.target.value })}
                  disabled={!form.enabled}
                />
              </label>
              <label className="field">
                <span>Client ID</span>
                <input
                  type="text"
                  value={form.clientId}
                  onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                  disabled={!form.enabled}
                />
              </label>
              <label className="field">
                <span>Client secret</span>
                <input
                  type="password"
                  placeholder={hasClientSecret ? "Unchanged (leave blank to keep current secret)" : ""}
                  value={form.clientSecret}
                  onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
                  disabled={!form.enabled}
                />
              </label>
              <label className="field">
                <span>Redirect URI</span>
                <input
                  type="url"
                  placeholder={defaultRedirect}
                  value={form.redirectUri}
                  onChange={(e) => setForm({ ...form, redirectUri: e.target.value })}
                  disabled={!form.enabled}
                />
              </label>
              <label className="field">
                <span>Scopes</span>
                <input
                  type="text"
                  value={form.scopes}
                  onChange={(e) => setForm({ ...form, scopes: e.target.value })}
                  disabled={!form.enabled}
                />
              </label>

              {error ? <div className="field-error">{error}</div> : null}
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
