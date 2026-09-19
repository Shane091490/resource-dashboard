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
  onSaveTitle,
}) {
  const [renamingTitle, setRenamingTitle] = useState(false);
  const canEdit = isAdmin && isEditMode;

  return (
    <header className="navbar">
      <div className="navbar-top">
        <div className="navbar-brand">
          <span className="navbar-logo" aria-hidden="true">
            🚀
          </span>
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
          <button
            key={p.id}
            type="button"
            className={"page-nav-btn" + (p.id === currentPageId ? " active" : "")}
            onClick={() => onNavigatePage(p)}
          >
            {p.name}
          </button>
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
          onSave={async (title) => {
            await onSaveTitle(title);
            setRenamingTitle(false);
          }}
          onCancel={() => setRenamingTitle(false)}
        />
      ) : null}
    </header>
  );
}
