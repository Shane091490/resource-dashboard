import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { imageUrl } from "../api.js";

export default function ResourceCard({ resource, isAdmin, isEditMode, onEdit, onDelete }) {
  const canEdit = isAdmin && isEditMode;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `resource-${resource.id}`,
    data: { type: "resource", resource },
    disabled: !canEdit,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const src = imageUrl(resource.image);

  return (
    <div ref={setNodeRef} style={style} className={"resource-card" + (isDragging ? " dragging" : "")}>
      {canEdit ? (
        <button type="button" className="drag-handle" aria-label="Drag to reorder" title="Drag to reorder" {...attributes} {...listeners}>
          ⠿
        </button>
      ) : null}
      <a className="resource-link" href={resource.url} target="_blank" rel="noopener noreferrer">
        <span className="resource-icon">
          {src ? <img src={src} alt="" loading="lazy" /> : <span className="resource-icon-fallback">{resource.name[0]?.toUpperCase()}</span>}
        </span>
        <span className="resource-body">
          <span className="resource-name">{resource.name}</span>
          {resource.description ? <span className="resource-description">{resource.description}</span> : null}
          {resource.tags?.length ? (
            <span className="resource-tags">
              {resource.tags.map((t) => (
                <span key={t} className="tag-chip">
                  {t}
                </span>
              ))}
            </span>
          ) : null}
        </span>
      </a>
      {canEdit ? (
        <div className="resource-actions">
          <button type="button" className="icon-btn" onClick={() => onEdit(resource)} aria-label={`Edit ${resource.name}`} title="Edit">
            ✎
          </button>
          <button type="button" className="icon-btn icon-btn-danger" onClick={() => onDelete(resource)} aria-label={`Delete ${resource.name}`} title="Delete">
            🗑
          </button>
        </div>
      ) : null}
    </div>
  );
}
