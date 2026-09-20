import { useEffect, useState, useCallback } from "react";
import { api } from "./api.js";
import Toast from "./components/Toast.jsx";
import AuthScreen from "./components/AuthScreen.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import UserManagementPage from "./pages/UserManagementPage.jsx";
import OidcSettingsPage from "./pages/OidcSettingsPage.jsx";
import PangolinSettingsPage from "./pages/PangolinSettingsPage.jsx";

function viewForPath(pathname) {
  if (pathname === "/register") return { view: "register" };
  if (pathname === "/login") return { view: "login" };
  if (pathname === "/settings/users") return { view: "user-management" };
  if (pathname === "/settings/oidc") return { view: "oidc-settings" };
  if (pathname === "/settings/pangolin") return { view: "pangolin-settings" };
  if (pathname === "/settings") return { view: "settings" };
  const pageMatch = pathname.match(/^\/page\/([^/]+)$/);
  if (pageMatch) return { view: "dashboard", slug: decodeURIComponent(pageMatch[1]) };
  return { view: "dashboard", slug: null };
}

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = logged out
  const [theme, setTheme] = useState(() => localStorage.getItem("dashboard-theme") || "light");
  const [toast, setToast] = useState("");
  const [route, setRoute] = useState(() => viewForPath(window.location.pathname));

  useEffect(() => {
    function onPop() {
      setRoute(viewForPath(window.location.pathname));
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("dashboard-theme", theme);
  }, [theme]);

  const navigate = useCallback((path, replace = false) => {
    if (replace) window.history.replaceState(null, "", path);
    else window.history.pushState(null, "", path);
    setRoute(viewForPath(path));
  }, []);

  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(""), 3500);
  }, []);

  useEffect(() => {
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (user === undefined) return;
    if (!user && route.view !== "login" && route.view !== "register") {
      navigate("/login", true);
    }
    if (user && (route.view === "login" || route.view === "register")) {
      navigate("/", true);
    }
    if (user && !user.is_admin && ["settings", "user-management", "oidc-settings", "pangolin-settings"].includes(route.view)) {
      navigate("/", true);
    }
  }, [user, route.view, navigate]);

  async function handleLogout() {
    await api.logout();
    setUser(null);
    navigate("/login", true);
  }

  if (user === undefined) {
    return (
      <div className="page-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <AuthScreen mode={route.view === "register" ? "register" : "login"} navigate={navigate} onAuthed={setUser} />
        {toast ? <Toast message={toast} /> : null}
      </>
    );
  }

  return (
    <>
      {route.view === "settings" && <SettingsPage navigate={navigate} showToast={showToast} />}
      {route.view === "user-management" && (
        <UserManagementPage currentUser={user} navigate={navigate} showToast={showToast} />
      )}
      {route.view === "oidc-settings" && <OidcSettingsPage navigate={navigate} showToast={showToast} />}
      {route.view === "pangolin-settings" && <PangolinSettingsPage navigate={navigate} showToast={showToast} />}
      {route.view === "dashboard" && (
        <DashboardPage
          user={user}
          slug={route.slug}
          navigate={navigate}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          onLogout={handleLogout}
          showToast={showToast}
        />
      )}
      {toast ? <Toast message={toast} /> : null}
    </>
  );
}
