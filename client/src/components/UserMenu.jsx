import { useEffect, useRef, useState } from "react";

function initials(user) {
  const a = (user.first_name || user.email || "?").trim()[0] || "?";
  const b = (user.last_name || "").trim()[0] || "";
  return (a + b).toUpperCase();
}

export default function UserMenu({ user, onOpenSettings, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="user-avatar">{initials(user)}</span>
        <span className="user-name">{displayName}</span>
        <span className="user-menu-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div className="user-menu-dropdown" role="menu">
          <div className="user-menu-header">
            <div className="user-menu-fullname">{displayName}</div>
            <div className="user-menu-email">{user.email}</div>
          </div>
          {user.is_admin ? (
            <button
              type="button"
              className="user-menu-item"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onOpenSettings();
              }}
            >
              ⚙️ Settings
            </button>
          ) : null}
          <button
            type="button"
            className="user-menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            ↪ Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}
