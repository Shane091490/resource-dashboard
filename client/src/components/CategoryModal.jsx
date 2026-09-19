import { useState } from "react";
import ImageField from "./ImageField.jsx";

export default function CategoryModal({ category, onSave, onCancel }) {
  const [name, setName] = useState(category?.name || "");
  const [image, setImage] = useState(category?.image || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSave({ name: name.trim(), image });
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
