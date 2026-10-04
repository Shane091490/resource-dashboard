import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors, closestCorners } from "@dnd-kit/core";
import { arrayMove, SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { api, imageUrl } from "../api.js";
import Navbar from "../components/Navbar.jsx";
import CategoryCard from "../components/CategoryCard.jsx";
import ResourceCard from "../components/ResourceCard.jsx";
import ResourceModal from "../components/ResourceModal.jsx";
import CategoryModal from "../components/CategoryModal.jsx";
import PageModal from "../components/PageModal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import MoveResourcesModal from "../components/MoveResourcesModal.jsx";

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

// Resolves any id that can appear as `over` while dragging a category card - the card's own
// sortable id, its nested resource drop-zone id, or (since collision detection compares against
// every registered droppable, nested resource rows included) an individual resource row's id -
// back to the plain numeric id of the category it belongs to.
function resolveCategoryId(categories, sortableId) {
  const id = String(sortableId);
  if (id.startsWith("categorycard-")) return Number(id.slice("categorycard-".length));
  if (id.startsWith("category-")) return Number(id.slice("category-".length));
  if (id.startsWith("resource-")) return locateContainer(categories, id);
  return null;
}

function columnCountForWidth(width) {
  if (width >= 1024) return 3;
  if (width >= 640) return 2;
  return 1;
}

// CSS multi-column (`column-count`) balances content height across columns and will happily use
// fewer than the requested count when there isn't much content, so a handful of short category
// cards can render in 2 columns instead of 3. Distributing into explicit column arrays here
// guarantees the requested column count regardless of content length.
function useColumnCount() {
  const [count, setCount] = useState(() => (typeof window === "undefined" ? 3 : columnCountForWidth(window.innerWidth)));

  useEffect(() => {
    function onResize() {
      setCount(columnCountForWidth(window.innerWidth));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return count;
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
  const [editingPage, setEditingPage] = useState(null);
  const [deletingPage, setDeletingPage] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [dashboardTitle, setDashboardTitle] = useState("Dashboard");
  const [dashboardIcon, setDashboardIcon] = useState("🚀");

  const [selectMode, setSelectMode] = useState(false);
  const [selectedResourceIds, setSelectedResourceIds] = useState(() => new Set());
  const [bulkMoving, setBulkMoving] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const categoriesRef = useRef(null);

  const isAdmin = !!user.is_admin;
  const canEdit = isAdmin && isEditMode;
  const columnCount = useColumnCount();

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
    api
      .getPublicSettings()
      .then(({ dashboardTitle, dashboardIcon }) => {
        setDashboardTitle(dashboardTitle);
        setDashboardIcon(dashboardIcon);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    document.title = dashboardTitle;
  }, [dashboardTitle]);

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

  const refreshDashboard = useCallback(async () => {
    if (!currentPage) return;
    const { categories } = await api.getDashboard(currentPage.id);
    setCategories(categories);
  }, [currentPage]);

  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);

  // Polls just the uptime status of resources on the current page every minute, patching it into
  // existing state rather than refetching the whole dashboard - a full refetch would blow away any
  // in-progress drag. Reads categoriesRef instead of depending on `categories` so the interval
  // itself isn't torn down and recreated by the state update this causes.
  useEffect(() => {
    if (!currentPage) return;
    let cancelled = false;
    async function poll() {
      const current = categoriesRef.current;
      if (!current || !current.length) return;
      const ids = current.flatMap((c) => c.resources.map((r) => r.id));
      if (!ids.length) return;
      try {
        const { statuses } = await api.getResourceStatus(ids);
        if (cancelled) return;
        const byId = new Map(statuses.map((s) => [s.id, s]));
        setCategories((prev) =>
          prev
            ? prev.map((c) => ({
                ...c,
                resources: c.resources.map((r) =>
                  byId.has(r.id)
                    ? { ...r, last_check_ok: byId.get(r.id).last_check_ok, last_checked_at: byId.get(r.id).last_checked_at }
                    : r
                ),
              }))
            : prev
        );
      } catch {
        /* transient poll failures are not worth surfacing to the user */
      }
    }
    const interval = setInterval(poll, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentPage]);

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

  const columns = useMemo(() => {
    // Distribute by estimated rendered height (header + one unit per resource) rather than
    // round-robin by index, so a page mixing large and small categories doesn't end up with one
    // tall column next to several short ones.
    const cols = Array.from({ length: columnCount }, () => []);
    const heights = Array.from({ length: columnCount }, () => 0);
    filteredCategories.forEach((cat) => {
      let shortest = 0;
      for (let i = 1; i < columnCount; i++) {
        if (heights[i] < heights[shortest]) shortest = i;
      }
      cols[shortest].push(cat);
      heights[shortest] += 1 + cat.resources.length;
    });
    return cols;
  }, [filteredCategories, columnCount]);

  function handleDragStart(event) {
    setActiveDragId(event.active.id);
    if (event.active.data.current?.type === "resource") {
      dragStartContainerRef.current = locateContainer(categories, event.active.id);
    }
  }

  function handleDragOver(event) {
    const { active, over } = event;
    if (!over || active.data.current?.type !== "resource") return;
    setCategories((prev) => {
      const fromId = locateContainer(prev, active.id);
      const toId = locateContainer(prev, over.id);
      if (!fromId || !toId || fromId === toId) return prev;
      return moveAcrossContainers(prev, active.id, fromId, toId, over.id);
    });
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    const kind = active.data.current?.type;
    const startContainerId = dragStartContainerRef.current;
    setActiveDragId(null);
    dragStartContainerRef.current = null;
    if (!over) return;

    if (kind === "category") {
      const overCategoryId = resolveCategoryId(categories, over.id);
      const activeCategoryId = resolveCategoryId(categories, active.id);
      if (!overCategoryId || overCategoryId === activeCategoryId) return;

      setCategories((prev) => {
        const oldIndex = prev.findIndex((c) => c.id === activeCategoryId);
        const newIndex = prev.findIndex((c) => c.id === overCategoryId);
        if (oldIndex === -1 || newIndex === -1) return prev;
        const reordered = arrayMove(prev, oldIndex, newIndex);
        api.reorderCategories(currentPage.id, reordered.map((c) => c.id)).catch((err) => showToast(err.message));
        return reordered;
      });
      return;
    }

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

  function handleToggleEditMode() {
    setIsEditMode((prev) => {
      const next = !prev;
      if (prev) showToast("Changes saved.");
      return next;
    });
    setSelectMode(false);
    setSelectedResourceIds(new Set());
  }

  function toggleSelectMode() {
    setSelectMode((prev) => !prev);
    setSelectedResourceIds(new Set());
  }

  function toggleSelectResource(id) {
    setSelectedResourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkMove(categoryId) {
    const ids = [...selectedResourceIds];
    await api.bulkMoveResources(ids, categoryId);
    await refreshDashboard();
    setBulkMoving(false);
    setSelectedResourceIds(new Set());
    setSelectMode(false);
    showToast(`Moved ${ids.length} resource${ids.length === 1 ? "" : "s"}.`);
  }

  async function handleBulkDelete() {
    const ids = [...selectedResourceIds];
    setBulkDeleting(false);
    try {
      await api.bulkDeleteResources(ids);
      await refreshDashboard();
      setSelectedResourceIds(new Set());
      setSelectMode(false);
      showToast(`Deleted ${ids.length} resource${ids.length === 1 ? "" : "s"}.`);
    } catch (err) {
      showToast(err.message);
    }
  }

  async function handleSaveTitle(title, icon) {
    const { dashboardTitle, dashboardIcon } = await api.saveAppSettings({ dashboardTitle: title, dashboardIcon: icon });
    setDashboardTitle(dashboardTitle);
    setDashboardIcon(dashboardIcon);
    showToast("Dashboard title updated.");
  }

  function handleNavigatePage(page) {
    setSearch("");
    setSelectMode(false);
    setSelectedResourceIds(new Set());
    navigate(pathForPage(page));
  }

  async function handleSavePage(name) {
    if (editingPage) {
      const { page: updated } = await api.updatePage(editingPage.id, { name });
      const nextPages = await loadPages();
      setEditingPage(null);
      if (currentPage?.id === updated.id) {
        const fresh = nextPages.find((p) => p.id === updated.id) || updated;
        navigate(pathForPage(fresh), true);
      }
    } else {
      const { page } = await api.createPage(name);
      const nextPages = await loadPages();
      setAddingPage(false);
      const created = nextPages.find((p) => p.id === page.id) || page;
      navigate(pathForPage(created));
    }
  }

  async function handleConfirmDeletePage() {
    const page = deletingPage;
    setDeletingPage(null);
    try {
      await api.deletePage(page.id);
      const nextPages = await loadPages();
      if (currentPage?.id === page.id) {
        const home = nextPages.find((p) => p.is_home) || nextPages[0];
        if (home) navigate(pathForPage(home), true);
      }
    } catch (err) {
      showToast(err.message);
    }
  }

  async function handleSaveCategory(data) {
    if (editingCategory) {
      const movedAway = data.page_id !== currentPage.id;
      await api.updateCategory(editingCategory.id, data);
      setEditingCategory(null);
      if (movedAway) {
        setCategories((prev) => prev.filter((c) => c.id !== editingCategory.id));
        showToast("Category moved to another page.");
      } else {
        await refreshDashboard();
      }
    } else {
      const { category } = await api.createCategory(data);
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
      const movedAway = data.category_id !== editingResource.category_id && !categories.some((c) => c.id === data.category_id);
      await api.updateResource(editingResource.id, data);
      setEditingResource(null);
      if (movedAway) showToast("Resource moved to another page.");
      await refreshDashboard();
    } else {
      const { resource } = await api.createResource(data);
      setAddingResourceTo(null);
      if (resource.category_id === addingResourceTo.id) {
        setCategories((prev) => prev.map((c) => (c.id === resource.category_id ? { ...c, resources: [...c.resources, resource] } : c)));
      } else {
        await refreshDashboard();
      }
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
    if (!activeDragId || !categories || !String(activeDragId).startsWith("resource-")) return null;
    for (const cat of categories) {
      const found = cat.resources.find((r) => `resource-${r.id}` === activeDragId);
      if (found) return found;
    }
    return null;
  }, [activeDragId, categories]);

  const activeCategory = useMemo(() => {
    if (!activeDragId || !categories || !String(activeDragId).startsWith("categorycard-")) return null;
    return categories.find((c) => `categorycard-${c.id}` === activeDragId) || null;
  }, [activeDragId, categories]);

  return (
    <div className="app-shell">
      <Navbar
        pages={pages}
        currentPageId={currentPage?.id}
        onNavigatePage={handleNavigatePage}
        isAdmin={isAdmin}
        onAddPage={() => setAddingPage(true)}
        onEditPage={setEditingPage}
        onDeletePage={setDeletingPage}
        search={search}
        onSearchChange={setSearch}
        theme={theme}
        onToggleTheme={onToggleTheme}
        user={user}
        isEditMode={isEditMode}
        onToggleEditMode={isAdmin ? handleToggleEditMode : undefined}
        onOpenSettings={() => navigate("/settings")}
        onLogout={onLogout}
        dashboardTitle={dashboardTitle}
        dashboardIcon={dashboardIcon}
        onSaveTitle={handleSaveTitle}
      />

      <main className="dashboard-main">
        {categories === null ? (
          <div className="page-loading">
            <div className="spinner" />
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
            <SortableContext items={filteredCategories.map((c) => `categorycard-${c.id}`)} strategy={rectSortingStrategy}>
              {filteredCategories.length ? (
                <div className="category-columns">
                  {columns.map((col, colIndex) => (
                    <div className="category-column" key={colIndex}>
                      {col.map((category) => (
                        <CategoryCard
                          key={category.id}
                          category={category}
                          isAdmin={isAdmin}
                          isEditMode={isEditMode}
                          selectMode={selectMode}
                          selectedIds={selectedResourceIds}
                          onToggleSelectResource={toggleSelectResource}
                          onEditCategory={setEditingCategory}
                          onDeleteCategory={setDeletingCategory}
                          onAddResource={setAddingResourceTo}
                          onEditResource={setEditingResource}
                          onDeleteResource={setDeletingResource}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="dashboard-empty">
                  {search
                    ? "No resources match your search."
                    : canEdit
                    ? "No categories yet. Tap the + button to add one."
                    : isAdmin
                    ? "No categories yet. Click Edit dashboard in the user menu to add one."
                    : "Nothing here yet."}
                </div>
              )}
            </SortableContext>
            <DragOverlay>
              {activeResource ? <ResourceCard resource={activeResource} isAdmin={isAdmin} isEditMode={isEditMode} onEdit={() => {}} onDelete={() => {}} /> : null}
              {activeCategory ? (
                <div className="category-card category-drag-preview">
                  <div className="category-header">
                    <span className="category-icon">
                      {imageUrl(activeCategory.image) ? (
                        <img src={imageUrl(activeCategory.image)} alt="" />
                      ) : (
                        <span className="category-icon-fallback">{activeCategory.name[0]?.toUpperCase()}</span>
                      )}
                    </span>
                    <h2 className="category-name">{activeCategory.name}</h2>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {canEdit && categories !== null ? (
          <button
            type="button"
            className={"fab-select-mode" + (selectMode ? " active" : "")}
            onClick={toggleSelectMode}
            aria-label="Select resources"
            title="Select resources"
          >
            ☑
          </button>
        ) : null}

        {canEdit && categories !== null ? (
          <button type="button" className="fab-add-category" onClick={() => setAddingCategory(true)} aria-label="Add category" title="Add category">
            +
          </button>
        ) : null}

        {selectMode && selectedResourceIds.size > 0 ? (
          <div className="bulk-action-bar">
            <span className="bulk-action-count">{selectedResourceIds.size} selected</span>
            <button type="button" className="btn" onClick={() => setBulkMoving(true)}>
              Move to...
            </button>
            <button type="button" className="btn btn-danger" onClick={() => setBulkDeleting(true)}>
              Delete
            </button>
            <button type="button" className="btn" onClick={() => setSelectedResourceIds(new Set())}>
              Clear
            </button>
          </div>
        ) : null}
      </main>

      {addingCategory ? (
        <CategoryModal pages={pages} currentPageId={currentPage?.id} onSave={handleSaveCategory} onCancel={() => setAddingCategory(false)} />
      ) : null}
      {editingCategory ? (
        <CategoryModal
          category={editingCategory}
          pages={pages}
          currentPageId={currentPage?.id}
          onSave={handleSaveCategory}
          onCancel={() => setEditingCategory(null)}
        />
      ) : null}
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
        <ResourceModal
          categoryName={addingResourceTo.name}
          categoryId={addingResourceTo.id}
          onSave={handleSaveResource}
          onCancel={() => setAddingResourceTo(null)}
        />
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

      {bulkMoving ? (
        <MoveResourcesModal count={selectedResourceIds.size} onMove={handleBulkMove} onCancel={() => setBulkMoving(false)} />
      ) : null}
      {bulkDeleting ? (
        <ConfirmDialog
          title="Delete resources"
          message={`Delete ${selectedResourceIds.size} selected resource(s)? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleBulkDelete}
          onCancel={() => setBulkDeleting(false)}
        />
      ) : null}

      {addingPage ? <PageModal onSave={handleSavePage} onCancel={() => setAddingPage(false)} /> : null}
      {editingPage ? <PageModal page={editingPage} onSave={handleSavePage} onCancel={() => setEditingPage(null)} /> : null}
      {deletingPage ? (
        <ConfirmDialog
          title="Delete page"
          message={`Delete "${deletingPage.name}" and all categories and resources on it? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleConfirmDeletePage}
          onCancel={() => setDeletingPage(null)}
        />
      ) : null}
    </div>
  );
}
