const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateNewUserFields({ email, password, first_name, last_name }) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanFirst = String(first_name || "").trim();
  const cleanLast = String(last_name || "").trim();

  if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) {
    return { error: "A valid email address is required" };
  }
  if (!cleanFirst || !cleanLast) {
    return { error: "First and last name are required" };
  }
  if (!password || password.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }

  return { email: cleanEmail, firstName: cleanFirst, lastName: cleanLast, password };
}

export function sanitizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const clean = tags
    .map((t) => String(t || "").trim().toLowerCase())
    .filter(Boolean)
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .slice(0, 25);
  return clean;
}

const URL_RE = /^https?:\/\/.+/i;

export function validateResourceFields({ name, description, url, tags, category_id }) {
  const cleanName = String(name || "").trim();
  const cleanUrl = String(url || "").trim();
  const categoryId = Number(category_id);

  if (!cleanName) return { error: "Name is required" };
  if (!cleanUrl || !URL_RE.test(cleanUrl)) return { error: "A valid URL (starting with http:// or https://) is required" };
  if (!categoryId || Number.isNaN(categoryId)) return { error: "A category is required" };

  return {
    name: cleanName,
    description: String(description || "").trim(),
    url: cleanUrl,
    tags: sanitizeTags(tags),
    categoryId,
  };
}

export function slugify(name) {
  const base = String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "page";
}
