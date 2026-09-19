# Resource Dashboard

A mobile-friendly, self-hosted resource launcher/dashboard. Organize links to your services into
categories on one or more pages, search by name or tag, and manage everything with admin-only
edit/delete controls and drag-and-drop reordering.

## Stack

- **nginx** — serves the built React app and reverse-proxies `/api` and `/uploads` to the app container.
- **app** — Node.js/Express API (JWT cookie auth, OIDC via `openid-client`, PostgreSQL via `pg`).
- **db** — PostgreSQL 16.

## Running it

```sh
cp .env.example .env   # edit POSTGRES_PASSWORD / JWT_SECRET / WEB_PORT as needed
docker compose up -d --build
```

The app is served on `http://<host>:${WEB_PORT:-8083}`.

## First run

The **first account you register becomes the admin**, and registration is automatically closed
right after (toggle it back on from Settings → General if you want open sign-ups). A default
"Home" page is seeded on first boot.

## Features

- Pages (admin-created, shown as buttons in the top nav) → category cards (vertical lists,
  arranged in a responsive 3/2/1-column layout) → resource cards, each linking out to a service.
- Search box filters resources by name or tag across the current page.
- Drag-and-drop resource cards within or between category cards (admin only).
- Light/dark theme toggle, persisted per browser.
- Settings page (Settings button lives in the user menu, top right): registration on/off,
  JSON export/import (with a confirm-before-overwrite step), and links to User management and
  OIDC configuration.
- OIDC single sign-on, compatible with any standards-compliant provider (Keycloak included). Set
  your provider's redirect URI to `https://<your-domain>/api/auth/oidc/callback`.
- Multi-user accounts (first/last name + email as the login username), role management, and
  password resets, all under Settings → Users.

## Data & images

Category/resource images can be uploaded (stored in the `dashboard_uploads` volume, served via
nginx at `/uploads/`) or linked by external URL. Exported JSON embeds uploaded images as base64,
so an export is fully self-contained and portable to a fresh instance.
