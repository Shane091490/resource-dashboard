import { useEffect, useState } from "react";
import { api } from "../api.js";
import ImageField from "./ImageField.jsx";

export default function ResourceModal({ resource, categoryName, onSave, onCancel }) {
  const [name, setName] = useState(resource?.name || "");
  const [description, setDescription] = useState(resource?.description || "");
  const [url, setUrl] = useState(resource?.url || "https://");
  const [tagsText, setTagsText] = useState((resource?.tags || []).join(", "));
  const [image, setImage] = useState(resource?.image || null);
  const [autoFilledImage, setAutoFilledImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Auto-suggest an icon from dashboardicons.com as the name is typed - but only while the image
  // field is still empty. Once the admin sets an image themselves (upload, URL, or removal), this
  // stops touching it, so it never clobbers a deliberate choice - including on an existing resource,
  // which already has an image and so is never eligible in the first place.
  useEffect(() => {
    if (image) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const handle = setTimeout(() => {
      api
        .lookupIcon(trimmed)
        .then(({ url }) => {
          if (url) {
            setImage(url);
            setAutoFilledImage(true);
          }
        })
        .catch(() => {});
    }, 500);
    return () => clearTimeout(handle);
  }, [name, image]);

  function handleImageChange(value) {
    setAutoFilledImage(false);
    setImage(value);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      await onSave({ name: name.trim(), description: description.trim(), url: url.trim(), tags, image });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={resource ? "Edit resource" : "Add resource"}>
        <h2>{resource ? "Edit resource" : "Add resource"}</h2>
        {categoryName ? <p className="modal-subtitle">Category: {categoryName}</p> : null}
        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Name</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </label>
          <label className="field">
            <span>URL</span>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" required />
          </label>
          <label className="field">
            <span>Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </label>
          <label className="field">
            <span>Tags (comma separated)</span>
            <input type="text" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="media, self-hosted" />
          </label>
          <label className="field">
            <span>Image</span>
            <ImageField value={image} onChange={handleImageChange} />
            {autoFilledImage ? (
              <span className="field-hint">Suggested from dashboardicons.com - replace or remove if not right.</span>
            ) : null}
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
