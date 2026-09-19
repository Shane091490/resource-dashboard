import { useDroppable } from "@dnd-kit/core";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { imageUrl } from "../api.js";
import ResourceCard from "./ResourceCard.jsx";

export default function CategoryCard({ category, isAdmin, isEditMode, onEditCategory, onDeleteCategory, onAddResource, onEditResource, onDeleteResource }) {
  const canEdit = isAdmin && isEditMode;

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `categorycard-${category.id}`,
    data: { type: "category", category },
    disabled: !canEdit,
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `category-${category.id}`,
    data: { type: "category", categoryId: category.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const src = imageUrl(category.image);
  const resourceIds = category.resources.map((r) => `resource-${r.id}`);

  return (
    <div ref={setSortableRef} style={style} className={"category-card" + (isDragging ? " dragging" : "")}>
      <div className="category-header">
        {canEdit ? (
          <button type="button" className="drag-handle" aria-label={`Drag to reorder ${category.name}`} title="Drag to reorder" {...attributes} {...listeners}>
            ⠿
          </button>
        ) : null}
        <span className="category-icon">
          {src ? <img src={src} alt="" /> : <span className="category-icon-fallback">{category.name[0]?.toUpperCase()}</span>}
        </span>
        <h2 className="category-name">{category.name}</h2>
        {canEdit ? (
          <div className="category-actions">
            <button type="button" className="icon-btn" onClick={() => onEditCategory(category)} aria-label={`Edit ${category.name}`} title="Edit category">
              ✎
            </button>
            <button type="button" className="icon-btn icon-btn-danger" onClick={() => onDeleteCategory(category)} aria-label={`Delete ${category.name}`} title="Delete category">
              🗑
            </button>
          </div>
        ) : null}
      </div>

      <div ref={setDroppableRef} className={"category-resource-list" + (isOver ? " drop-active" : "")}>
        <SortableContext items={resourceIds} strategy={verticalListSortingStrategy}>
          {category.resources.map((r) => (
            <ResourceCard key={r.id} resource={r} isAdmin={isAdmin} isEditMode={isEditMode} onEdit={onEditResource} onDelete={onDeleteResource} />
          ))}
        </SortableContext>
        {category.resources.length === 0 ? <div className="category-empty">No resources yet.</div> : null}
      </div>

      {canEdit ? (
        <button type="button" className="btn btn-add-resource" onClick={() => onAddResource(category)}>
          + Add resource
        </button>
      ) : null}
    </div>
  );
}
