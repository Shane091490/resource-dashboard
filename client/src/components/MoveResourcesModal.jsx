import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";

export default function MoveResourcesModal({ count, onMove, onCancel }) {
  const [allCategories, setAllCategories] = useState([]);
  const [targetCategoryId, setTargetCategoryId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .listAllCategories()
      .then(({ categories }) => {
        setAllCategories(categories);
        if (categories.length) setTargetCategoryId(categories[0].id);
      })
      .catch((err) => setError(err.message));
  }, []);

  const groupedCategories = useMemo(() => {
    const map = new Map();
    for (const c of allCategories) {
      if (!map.has(c.page_name)) map.set(c.page_name, []);
      map.get(c.page_name).push(c);
    }
    return [...map.entries()];
  }, [allCategories]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onMove(targetCategoryId);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal small" role="dialog" aria-modal="true" aria-label="Move resources">
        <h2>
          Move {count} resource{count === 1 ? "" : "s"}
        </h2>
        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Move to category</span>
            <select value={targetCategoryId || ""} onChange={(e) => setTargetCategoryId(Number(e.target.value))}>
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
          {error ? <div className="field-error">{error}</div> : null}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !targetCategoryId}>
              {saving ? "Moving..." : "Move"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
