const BASE = "/api";

async function readError(res) {
  let message = `Request failed (${res.status})`;
  try {
    const data = await res.json();
    if (data.error) message = data.error;
  } catch {
    /* ignore non-JSON error bodies */
  }
  return message;
}

async function request(path, { method = "GET", body, headers } = {}) {
  const res = await fetch(BASE + path, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) throw new Error(await readError(res));
  if (res.status === 204) return null;
  return res.json();
}

async function uploadImage(file) {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch(`${BASE}/uploads/image`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export const api = {
  register: (email, password, firstName, lastName) =>
    request("/auth/register", { method: "POST", body: { email, password, first_name: firstName, last_name: lastName } }),
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me"),
  oidcConfig: () => request("/auth/oidc/config"),
  registrationStatus: () => request("/auth/registration-status"),
  getPublicSettings: () => request("/settings"),

  listPages: () => request("/pages"),
  getDashboard: (pageId) => request(`/pages/${pageId}/dashboard`),
  createPage: (name) => request("/pages", { method: "POST", body: { name } }),
  updatePage: (id, data) => request(`/pages/${id}`, { method: "PUT", body: data }),
  deletePage: (id) => request(`/pages/${id}`, { method: "DELETE" }),

  createCategory: (data) => request("/categories", { method: "POST", body: data }),
  updateCategory: (id, data) => request(`/categories/${id}`, { method: "PUT", body: data }),
  deleteCategory: (id) => request(`/categories/${id}`, { method: "DELETE" }),
  reorderCategories: (pageId, order) => request("/categories/reorder", { method: "PUT", body: { page_id: pageId, order } }),

  createResource: (data) => request("/resources", { method: "POST", body: data }),
  updateResource: (id, data) => request(`/resources/${id}`, { method: "PUT", body: data }),
  deleteResource: (id) => request(`/resources/${id}`, { method: "DELETE" }),
  reorderResources: (categoryId, order) =>
    request("/resources/reorder", { method: "PUT", body: { category_id: categoryId, order } }),

  uploadImage: (file) => uploadImage(file),
  lookupIcon: (name) => request(`/icons/lookup?name=${encodeURIComponent(name)}`),

  listUsers: () => request("/admin/users"),
  createUser: (data) => request("/admin/users", { method: "POST", body: data }),
  setUserRole: (id, isAdmin) => request(`/admin/users/${id}`, { method: "PUT", body: { is_admin: isAdmin } }),
  resetUserPassword: (id, password) => request(`/admin/users/${id}/reset-password`, { method: "POST", body: { password } }),
  deleteUser: (id) => request(`/admin/users/${id}`, { method: "DELETE" }),

  getAppSettings: () => request("/admin/app-settings"),
  saveAppSettings: (settings) => request("/admin/app-settings", { method: "PUT", body: settings }),

  getOidcSettings: () => request("/admin/oidc"),
  saveOidcSettings: (settings) => request("/admin/oidc", { method: "PUT", body: settings }),

  exportData: () => request("/data/export"),
  importData: (data) => request("/data/import", { method: "POST", body: { confirm: true, data } }),
  wipeData: () => request("/data/wipe", { method: "DELETE", body: { confirm: "DELETE" } }),
};

export function imageUrl(image) {
  if (!image) return null;
  if (/^https?:\/\//i.test(image)) return image;
  return `/uploads/${image}`;
}

export function downloadExport() {
  const a = document.createElement("a");
  a.href = BASE + "/data/export";
  a.download = "resource-dashboard-export.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
