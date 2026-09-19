import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors, closestCorners } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { api } from "../api.js";
import Navbar from "../components/Navbar.jsx";
import CategoryCard from "../components/CategoryCard.jsx";
import ResourceCard from "../components/ResourceCard.jsx";
import ResourceModal from "../components/ResourceModal.jsx";
import CategoryModal from "../components/CategoryModal.jsx";
import PageModal from "../components/PageModal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";

function pathForPage(page) {
  return page.is_home ? "/" : `/page/${page.slug}`;
}

function locateContainer(categories, sortableId) {
  if (typeof sortableId !== "string") return null;
  if (sortableId.startsWith("category-")) return Number(sortableId.slice("category-".length));
  for (const cat of categories) {
    if (cat.resources.some((r) => `resource-${r.id}` === sortableId)) return cat.id;
  }
  return null;
}

function moveAcrossContainers(categories, activeSortableId, fromCategoryId, toCategoryId, overSortableId) {
  const fromCat = categories.find((c) => c.id === fromCategoryId);
  const movedResource = fromCat?.resources.find((r) => `resource-${r.id}` === activeSortableId);
  if (!movedResource) return categories;

  return categories.map((cat) => {
    if (cat.id === fromCategoryId) {
      return { ...cat, resources: cat.resources.filter((r) => `resource-${r.id}` !== activeSortableId) };
    }
    if (cat.id === toCategoryId) {
      const overIndex = cat.resources.findIndex((r) => `resource-${r.id}` === overSortableId);
      const insertAt = overIndex >= 0 ? overIndex : cat.resources.length;
      const next = [...cat.resources];
      next.splice(insertAt, 0, movedResource);
      return { ...cat, resources: next };
    }
    return cat;
  });
}

export default function DashboardPage({ user, slug, navigate, theme, onToggleTheme, onLogout, showToast }) {
  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(null);
  const [categories, setCategories] = useState(null); // null = loading
  const [search, setSearch] = useState("");
  const [activeDragId, setActiveDragId] = useState(null);
  const dragStartContainerRef = useRef(null);

  const [addingResourceTo, setAddingResourceTo] = useState(null); // category object
  const [editingResource, setEditingResource] = useState(null);
  const [deletingResource, setDeletingResource] = useState(null);

  const [addingCategory, setAddingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(null);

  const [addingPage, setAddingPage] = useState(false);

  const isAdmin = !!user.is_admin;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const loadPages = useCallback(async () => {
    const { pages } = await api.listPages();
    setPages(pages);
    return pages;
  }, []);

  useEffect(() => {
    loadPages().catch((err) => showToast(err.message));
  }, [loadPages, showToast]);

  useEffect(() => {
    if (!pages.length) return;
    const target = slug ? pages.find((p) => p.slug === slug) : pages.find((p) => p.is_home) || pages[0];
    if (!target) {
      navigate("/", true);
      return;
    }
    setCurrentPage(target);
  }, [pages, slug, navigate]);

  useEffect(() => {
    if (!currentPage) return;
    let cancelled = false;
    setCategories(null);
    api
      .getDashboard(currentPage.id)
      .then(({ categories }) => {
        if (!cancelled) setCategories(categories);
      })
      .catch((err) => showToast(err.message));
    return () => {
      cancelled = true;
    };
  }, [currentPage, showToast]);

  const filteredCategories = useMemo(() => {
    if (!categories) return [];
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map((cat) => ({
        ...cat,
        resources: cat.resources.filter(
          (r) => r.name.toLowerCase().includes(q) || r.tags.some((t) => t.toLowerCase().includes(q))
        ),
      }))
      .filter((cat) => cat.resources.length > 0);
  }, [categories, search]);

  function handleDragStart(event) {
    setActiveDragId(event.active.id);
    dragStartContainerRef.current = locateContainer(categories, event.active.id);
  }

  function handleDragOver(event) {
    const { active, over } = event;
    if (!over) return;
    setCategories((prev) => {
      const fromId = locateContainer(prev, active.id);
      const toId = locateContainer(prev, over.id);
      if (!fromId || !toId || fromId === toId) return prev;
      return moveAcrossContainers(prev, active.id, fromId, toId, over.id);
    });
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    const startContainerId = dragStartContainerRef.current;
    setActiveDragId(null);
    dragStartContainerRef.current = null;
    if (!over) return;

    setCategories((prev) => {
      const containerId = locateContainer(prev, active.id);
      if (!containerId) return prev;
      const cat = prev.find((c) => c.id === containerId);
      const oldIndex = cat.resources.findIndex((r) => `resource-${r.id}` === active.id);
      let newIndex;
      if (typeof over.id === "string" && over.id.startsWith("category-")) {
        newIndex = cat.resources.length - 1;
      } else {
        newIndex = cat.resources.findIndex((r) => `resource-${r.id}` === over.id);
      }
      if (oldIndex === -1 || newIndex === -1) return prev;

      const reordered = arrayMove(cat.resources, oldIndex, newIndex);
      const next = prev.map((c) => (c.id === containerId ? { ...c, resources: reordered } : c));

      api.reorderResources(containerId, reordered.map((r) => r.id)).catch((err) => showToast(err.message));
      if (startContainerId && startContainerId !== containerId) {
        const sourceCat = next.find((c) => c.id === startContainerId);
        if (sourceCat) {
          api.reorderResources(startContainerId, sourceCat.resources.map((r) => r.id)).catch((err) => showToast(err.message));
        }
      }
      return next;
    });
  }

  function handleNavigatePage(page) {
    setSearch("");
    navigate(pathForPage(page));
  }

  async function handleAddPage(name) {
    const { page } = await api.createPage(name);
    const nextPages = await loadPages();
    setAddingPage(false);
    const created = nextPages.find((p) => p.id === page.id) || page;
    navigate(pathForPage(created));
  }

  async function handleSaveCategory(data) {
    if (editingCategory) {
      const { category } = await api.updateCategory(editingCategory.id, data);
      setCategories((prev) => prev.map((c) => (c.id === category.id ? { ...c, ...category } : c)));
      setEditingCategory(null);
    } else {
      const { category } = await api.createCategory({ ...data, page_id: currentPage.id });
      setCategories((prev) => [...prev, category]);
      setAddingCategory(false);
    }
  }

  async function handleConfirmDeleteCategory() {
    const category = deletingCategory;
    setDeletingCategory(null);
    try {
      await api.deleteCategory(category.id);
      setCategories((prev) => prev.filter((c) => c.id !== category.id));
    } catch (err) {
      showToast(err.message);
    }
  }

  async function handleSaveResource(data) {
    if (editingResource) {
      const { resource } = await api.updateResource(editingResource.id, data);
      setCategories((prev) =>
        prev.map((c) =>
          c.id === resource.category_id ? { ...c, resources: c.resources.map((r) => (r.id === resource.id ? resource : r)) } : c
        )
      );
      setEditingResource(null);
    } else {
      const { resource } = await api.createResource({ ...data, category_id: addingResourceTo.id });
      setCategories((prev) => prev.map((c) => (c.id === addingResourceTo.id ? { ...c, resources: [...c.resources, resource] } : c)));
      setAddingResourceTo(null);
    }
  }

  async function handleConfirmDeleteResource() {
    const resource = deletingResource;
    setDeletingResource(null);
    try {
      await api.deleteResource(resource.id);
      setCategories((prev) => prev.map((c) => (c.id === resource.category_id ? { ...c, resources: c.resources.filter((r) => r.id !== resource.id) } : c)));
    } catch (err) {
      showToast(err.message);
    }
  }

  const activeResource = useMemo(() => {
    if (!activeDragId || !categories) return null;
    for (const cat of categories) {
      const found = cat.resources.find((r) => `resource-${r.id}` === activeDragId);
      if (found) return found;
    }
    return null;
  }, [activeDragId, categories]);

  return (
    <div className="app-shell">
      <Navbar
        pages={pages}
        currentPageId={currentPage?.id}
        onNavigatePage={handleNavigatePage}
        isAdmin={isAdmin}
        onAddPage={() => setAddingPage(true)}
        search={search}
        onSearchChange={setSearch}
        theme={theme}
        onToggleTheme={onToggleTheme}
        user={user}
        onOpenSettings={() => navigate("/settings")}
        onLogout={onLogout}
      />

      <main className="dashboard-main">
        {categories === null ? (
          <div className="page-loading">
            <div className="spinner" />
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
            <div className="category-columns">
              {filteredCategories.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  isAdmin={isAdmin}
                  onEditCategory={setEditingCategory}
                  onDeleteCategory={setDeletingCategory}
                  onAddResource={setAddingResourceTo}
                  onEditResource={setEditingResource}
                  onDeleteResource={setDeletingResource}
                />
              ))}
              {!filteredCategories.length ? (
                <div className="dashboard-empty">
                  {search ? "No resources match your search." : isAdmin ? "No categories yet. Add one to get started." : "Nothing here yet."}
                </div>
              ) : null}
            </div>
            <DragOverlay>
              {activeResource ? <ResourceCard resource={activeResource} isAdmin={isAdmin} onEdit={() => {}} onDelete={() => {}} /> : null}
            </DragOverlay>
          </DndContext>
        )}

        {isAdmin && categories !== null ? (
          <button type="button" className="btn btn-add-category" onClick={() => setAddingCategory(true)}>
            + Add category
          </button>
        ) : null}
      </main>

      {addingCategory ? <CategoryModal onSave={handleSaveCategory} onCancel={() => setAddingCategory(false)} /> : null}
      {editingCategory ? <CategoryModal category={editingCategory} onSave={handleSaveCategory} onCancel={() => setEditingCategory(null)} /> : null}
      {deletingCategory ? (
        <ConfirmDialog
          title="Delete category"
          message={`Delete "${deletingCategory.name}" and all resources inside it? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleConfirmDeleteCategory}
          onCancel={() => setDeletingCategory(null)}
        />
      ) : null}

      {addingResourceTo ? (
        <ResourceModal categoryName={addingResourceTo.name} onSave={handleSaveResource} onCancel={() => setAddingResourceTo(null)} />
      ) : null}
      {editingResource ? (
        <ResourceModal resource={editingResource} onSave={handleSaveResource} onCancel={() => setEditingResource(null)} />
      ) : null}
      {deletingResource ? (
        <ConfirmDialog
          title="Delete resource"
          message={`Delete "${deletingResource.name}"?`}
          confirmLabel="Delete"
          danger
          onConfirm={handleConfirmDeleteResource}
          onCancel={() => setDeletingResource(null)}
        />
      ) : null}

      {addingPage ? <PageModal onSave={handleAddPage} onCancel={() => setAddingPage(false)} /> : null}
    </div>
  );
}
