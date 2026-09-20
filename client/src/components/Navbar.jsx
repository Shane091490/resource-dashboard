import { useState } from "react";
import SearchBox from "./SearchBox.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import UserMenu from "./UserMenu.jsx";
import DashboardTitleModal from "./DashboardTitleModal.jsx";

export default function Navbar({
  pages,
  currentPageId,
  onNavigatePage,
  isAdmin,
  onAddPage,
  onEditPage,
  onDeletePage,
  search,
  onSearchChange,
  theme,
  onToggleTheme,
  user,
  isEditMode,
  onToggleEditMode,
  onOpenSettings,
  onLogout,
  dashboardTitle,
  dashboardIcon,
  onSaveTitle,
}) {
  const [renamingTitle, setRenamingTitle] = useState(false);
  const canEdit = isAdmin && isEditMode;

  return (
    <header className="navbar">
      <div className="navbar-top">
        <div className="navbar-brand">
          {dashboardIcon ? (
            <span className="navbar-logo" aria-hidden="true">
              {dashboardIcon}
            </span>
          ) : null}
          <span className="navbar-title">{dashboardTitle}</span>
          {canEdit ? (
            <button
              type="button"
              className="icon-btn navbar-title-edit"
              onClick={() => setRenamingTitle(true)}
              aria-label="Rename dashboard"
              title="Rename dashboard"
            >
              ✎
            </button>
          ) : null}
        </div>
        <div className="navbar-right">
          <SearchBox value={search} onChange={onSearchChange} />
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <UserMenu user={user} isEditMode={isEditMode} onToggleEditMode={onToggleEditMode} onOpenSettings={onOpenSettings} onLogout={onLogout} />
        </div>
      </div>
      <nav className="page-nav" aria-label="Dashboard pages">
        {pages.map((p) => (
          <div className="page-nav-item" key={p.id}>
            <button
              type="button"
              className={"page-nav-btn" + (p.id === currentPageId ? " active" : "")}
              onClick={() => onNavigatePage(p)}
            >
              {p.name}
            </button>
            {canEdit ? (
              <span className="page-nav-actions">
                <button
                  type="button"
                  className="icon-btn page-nav-icon"
                  onClick={() => onEditPage(p)}
                  aria-label={`Rename ${p.name}`}
                  title="Rename page"
                >
                  ✎
                </button>
                {!p.is_home ? (
                  <button
                    type="button"
                    className="icon-btn page-nav-icon"
                    onClick={() => onDeletePage(p)}
                    aria-label={`Delete ${p.name}`}
                    title="Delete page"
                  >
                    🗑
                  </button>
                ) : null}
              </span>
            ) : null}
          </div>
        ))}
        {canEdit ? (
          <button type="button" className="page-nav-btn page-nav-add" onClick={onAddPage} title="Add a new page" aria-label="Add a new page">
            + Page
          </button>
        ) : null}
      </nav>

      {renamingTitle ? (
        <DashboardTitleModal
          currentTitle={dashboardTitle}
          currentIcon={dashboardIcon}
          onSave={async (title, icon) => {
            await onSaveTitle(title, icon);
            setRenamingTitle(false);
          }}
          onCancel={() => setRenamingTitle(false)}
        />
      ) : null}
    </header>
  );
}
