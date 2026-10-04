import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import ImageField from "./ImageField.jsx";

// Tries the site's own favicon as a last-resort icon suggestion when dashboardicons.com has no
// match for the name. This runs client-side (an <img> probe, not a fetch) so it works for local
// network URLs the server container may not be able to reach, and needs no CORS support from the
// target site.
function tryFaviconFallback(rawUrl) {
  return new Promise((resolve) => {
    let origin;
    try {
      origin = new URL(rawUrl).origin;
    } catch {
      resolve(null);
      return;
    }
    const candidate = `${origin}/favicon.ico`;
    const img = new window.Image();
    const timer = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      resolve(null);
    }, 4000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(candidate);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = candidate;
  });
}

export default function ResourceModal({ resource, categoryName, categoryId, onSave, onCancel }) {
  const [name, setName] = useState(resource?.name || "");
  const [description, setDescription] = useState(resource?.description || "");
  const [url, setUrl] = useState(resource?.url || "https://");
  const [tagsText, setTagsText] = useState((resource?.tags || []).join(", "));
  const [image, setImage] = useState(resource?.image || null);
  const [autoFilledImage, setAutoFilledImage] = useState(false);
  const [autoFillSource, setAutoFillSource] = useState(null);
  const [targetCategoryId, setTargetCategoryId] = useState(resource?.category_id || categoryId);
  const [allCategories, setAllCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .listAllCategories()
      .then(({ categories }) => setAllCategories(categories))
      .catch(() => {});
  }, []);

  const groupedCategories = useMemo(() => {
    const map = new Map();
    for (const c of allCategories) {
      if (!map.has(c.page_name)) map.set(c.page_name, []);
      map.get(c.page_name).push(c);
    }
    return [...map.entries()];
  }, [allCategories]);

  // Auto-suggest an icon as the name (and, for the favicon fallback, the URL) is typed - but only
  // while the image field is still empty. Once the admin sets an image themselves (upload, URL, or
  // removal), this stops touching it, so it never clobbers a deliberate choice - including on an
  // existing resource, which already has an image and so is never eligible in the first place.
  useEffect(() => {
    if (image) return;
    const trimmedName = name.trim();
    if (!trimmedName) return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const { url: iconUrl } = await api.lookupIcon(trimmedName);
        if (cancelled) return;
        if (iconUrl) {
          setImage(iconUrl);
          setAutoFilledImage(true);
          setAutoFillSource("dashboardicons");
          return;
        }
        const trimmedUrl = url.trim();
        if (/^https?:\/\//i.test(trimmedUrl)) {
          const favicon = await tryFaviconFallback(trimmedUrl);
          if (!cancelled && favicon) {
            setImage(favicon);
            setAutoFilledImage(true);
            setAutoFillSource("favicon");
          }
        }
      } catch {
        /* icon suggestion is best-effort */
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [name, url, image]);

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
      await onSave({
        name: name.trim(),
        description: description.trim(),
        url: url.trim(),
        tags,
        image,
        category_id: targetCategoryId,
      });
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
          {groupedCategories.length ? (
            <label className="field">
              <span>Category</span>
              <select value={targetCategoryId} onChange={(e) => setTargetCategoryId(Number(e.target.value))}>
                {groupedCategories.map(([pageName, cats]) => (
                  <optgroup key={pageName} label={pageName}>
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          ) : null}
          <label className="field">
            <span>Image</span>
            <ImageField value={image} onChange={handleImageChange} />
            {autoFilledImage ? (
              <span className="field-hint">
                {autoFillSource === "favicon" ? "Suggested from the site's favicon" : "Suggested from dashboardicons.com"} - replace or
                remove if not right.
              </span>
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
