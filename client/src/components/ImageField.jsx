import { useState } from "react";
import { api, imageUrl } from "../api.js";

export default function ImageField({ value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [urlDraft, setUrlDraft] = useState("");

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const { image } = await api.uploadImage(file);
      onChange(image);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function applyUrl() {
    const trimmed = urlDraft.trim();
    if (!trimmed) return;
    if (!/^https?:\/\//i.test(trimmed)) {
      setError("Image URL must start with http:// or https://");
      return;
    }
    setError("");
    onChange(trimmed);
    setUrlDraft("");
  }

  const preview = imageUrl(value);

  return (
    <div className="image-field">
      <div className="image-field-preview">
        {preview ? <img src={preview} alt="Preview" /> : <div className="image-field-placeholder">No image</div>}
      </div>
      <div className="image-field-controls">
        <label className="btn btn-file">
          {uploading ? "Uploading..." : "Upload image"}
          <input type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" onChange={handleFile} disabled={uploading} hidden />
        </label>
        <div className="image-field-url-row">
          <input
            type="text"
            placeholder="Or paste an image URL"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), applyUrl())}
          />
          <button type="button" className="btn" onClick={applyUrl}>
            Use URL
          </button>
        </div>
        {value ? (
          <button type="button" className="btn btn-link-danger" onClick={() => onChange(null)}>
            Remove image
          </button>
        ) : null}
        {error ? <div className="field-error">{error}</div> : null}
      </div>
    </div>
  );
}
