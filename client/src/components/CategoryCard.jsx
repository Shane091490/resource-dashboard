import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { imageUrl } from "../api.js";
import ResourceCard from "./ResourceCard.jsx";

export default function CategoryCard({ category, isAdmin, onEditCategory, onDeleteCategory, onAddResource, onEditResource, onDeleteResource }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `category-${category.id}`,
    data: { type: "category", categoryId: category.id },
  });

  const src = imageUrl(category.image);
  const resourceIds = category.resources.map((r) => `resource-${r.id}`);

  return (
    <div className="category-card">
      <div className="category-header">
        <span className="category-icon">
          {src ? <img src={src} alt="" /> : <span className="category-icon-fallback">{category.name[0]?.toUpperCase()}</span>}
        </span>
        <h2 className="category-name">{category.name}</h2>
        {isAdmin ? (
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

      <div ref={setNodeRef} className={"category-resource-list" + (isOver ? " drop-active" : "")}>
        <SortableContext items={resourceIds} strategy={verticalListSortingStrategy}>
          {category.resources.map((r) => (
            <ResourceCard key={r.id} resource={r} isAdmin={isAdmin} onEdit={onEditResource} onDelete={onDeleteResource} />
          ))}
        </SortableContext>
        {category.resources.length === 0 ? <div className="category-empty">No resources yet.</div> : null}
      </div>

      {isAdmin ? (
        <button type="button" className="btn btn-add-resource" onClick={() => onAddResource(category)}>
          + Add resource
        </button>
      ) : null}
    </div>
  );
}
