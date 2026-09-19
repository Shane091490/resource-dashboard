import { useEffect, useState } from "react";
import { api } from "../api.js";
import ConfirmDialog from "../components/ConfirmDialog.jsx";

const emptyForm = { email: "", first_name: "", last_name: "", password: "", is_admin: false };

export default function UserManagementPage({ currentUser, navigate, showToast }) {
  const [users, setUsers] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  function load() {
    api
      .listUsers()
      .then(({ users }) => setUsers(users))
      .catch((err) => showToast(err.message));
  }

  useEffect(load, [showToast]);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.createUser(form);
      setForm(emptyForm);
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleRole(user) {
    try {
      await api.setUserRole(user.id, !user.is_admin);
      load();
    } catch (err) {
      showToast(err.message);
    }
  }

  async function submitReset(e) {
    e.preventDefault();
    try {
      await api.resetUserPassword(resetTarget.id, resetPassword);
      showToast(`Password reset for ${resetTarget.email}.`);
      setResetTarget(null);
      setResetPassword("");
    } catch (err) {
      showToast(err.message);
    }
  }

  async function confirmDelete() {
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await api.deleteUser(target.id);
      load();
    } catch (err) {
      showToast(err.message);
    }
  }

  return (
    <div className="app-shell">
      <header className="settings-header">
        <button type="button" className="back-btn" onClick={() => navigate("/settings")} aria-label="Back to settings">
          ←
        </button>
        <h1>User management</h1>
      </header>

      <main className="settings-main">
        <section className="settings-section">
          <div className="settings-section-heading-row">
            <h2>Users</h2>
            <button type="button" className="btn btn-primary" onClick={() => setShowCreate((s) => !s)}>
              {showCreate ? "Cancel" : "+ New user"}
            </button>
          </div>

          {showCreate ? (
            <form className="inline-form" onSubmit={handleCreate}>
              <div className="field-row">
                <label className="field">
                  <span>First name</span>
                  <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
                </label>
                <label className="field">
                  <span>Last name</span>
                  <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
                </label>
              </div>
              <label className="field">
                <span>Email</span>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </label>
              <label className="field">
                <span>Password</span>
                <input type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </label>
              <label className="settings-toggle-row">
                <span>Admin</span>
                <input type="checkbox" checked={form.is_admin} onChange={(e) => setForm({ ...form, is_admin: e.target.checked })} />
              </label>
              {error ? <div className="field-error">{error}</div> : null}
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Creating..." : "Create user"}
              </button>
            </form>
          ) : null}

          <div className="user-table">
            {users === null ? (
              <div className="page-loading">
                <div className="spinner" />
              </div>
            ) : (
              users.map((u) => (
                <div className="user-row" key={u.id}>
                  <div className="user-row-info">
                    <div className="user-row-name">
                      {u.first_name} {u.last_name} {u.id === currentUser.id ? <span className="badge">You</span> : null}
                      {u.is_sso ? <span className="badge badge-muted">SSO</span> : null}
                    </div>
                    <div className="user-row-email">{u.email}</div>
                  </div>
                  <div className="user-row-actions">
                    <label className="settings-toggle-row compact">
                      <span>Admin</span>
                      <input type="checkbox" checked={u.is_admin} disabled={u.id === currentUser.id} onChange={() => toggleRole(u)} />
                    </label>
                    {!u.is_sso ? (
                      <button type="button" className="btn" onClick={() => setResetTarget(u)}>
                        Reset password
                      </button>
                    ) : null}
                    <button type="button" className="btn btn-danger" disabled={u.id === currentUser.id} onClick={() => setDeleteTarget(u)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {resetTarget ? (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setResetTarget(null)}>
          <div className="modal small" role="dialog" aria-modal="true" aria-label="Reset password">
            <h2>Reset password</h2>
            <p className="modal-subtitle">{resetTarget.email}</p>
            <form onSubmit={submitReset}>
              <label className="field">
                <span>New password</span>
                <input type="password" minLength={6} value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} required autoFocus />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setResetTarget(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Reset password
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title="Delete user"
          message={`Delete the account for ${deleteTarget.email}? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      ) : null}
    </div>
  );
}
