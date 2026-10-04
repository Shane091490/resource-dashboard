import { useState } from "react";
import ImageField from "./ImageField.jsx";
import ToggleSwitch from "./ToggleSwitch.jsx";

export default function CategoryModal({ category, pages, currentPageId, onSave, onCancel }) {
  const [name, setName] = useState(category?.name || "");
  const [image, setImage] = useState(category?.image || null);
  const [adminOnly, setAdminOnly] = useState(category?.admin_only || false);
  const [pageId, setPageId] = useState(category?.page_id || currentPageId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSave({ name: name.trim(), image, admin_only: adminOnly, page_id: pageId });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={category ? "Edit category" : "Add category"}>
        <h2>{category ? "Edit category" : "Add category"}</h2>
        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Name</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </label>
          <label className="field">
            <span>Image</span>
            <ImageField value={image} onChange={setImage} />
          </label>
          {pages && pages.length > 1 ? (
            <label className="field">
              <span>Page</span>
              <select value={pageId} onChange={(e) => setPageId(Number(e.target.value))}>
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="field field-toggle-row">
            <span>Admin only (hidden from regular users)</span>
            <ToggleSwitch checked={adminOnly} onChange={setAdminOnly} ariaLabel="Admin only" />
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
