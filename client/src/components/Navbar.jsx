import SearchBox from "./SearchBox.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import UserMenu from "./UserMenu.jsx";

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
}) {
  return (
    <header className="navbar">
      <div className="navbar-top">
        <div className="navbar-brand">
          <span className="navbar-logo" aria-hidden="true">
            🚀
          </span>
          <span className="navbar-title">Dashboard</span>
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
        {isAdmin ? (
          <button type="button" className="page-nav-btn page-nav-add" onClick={onAddPage} title="Add a new page" aria-label="Add a new page">
            + Page
          </button>
        ) : null}
      </nav>
    </header>
  );
}
