import { useState } from "react";

export default function DashboardTitleModal({ currentTitle, currentIcon, onSave, onCancel }) {
  const [title, setTitle] = useState(currentTitle);
  const [icon, setIcon] = useState(currentIcon || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSave(title.trim(), icon.trim());
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal small" role="dialog" aria-modal="true" aria-label="Rename dashboard">
        <h2>Dashboard title</h2>
        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Title</span>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus maxLength={60} />
          </label>
          <label className="field">
            <span>Icon (optional)</span>
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="e.g. 🚀 - leave blank for no icon"
              maxLength={16}
            />
          </label>
          {error ? <div className="field-error">{error}</div> : null}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
