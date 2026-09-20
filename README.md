# Resource Dashboard

A self-hosted dashboard for organizing links to all the apps and services you run. Add resources with a name, description, tags and an icon, group them into categories, and search across everything from one screen.

## Features

- Category cards holding your resource links, arranged on a responsive dashboard
- Multiple pages, each with its own button in the top navigation
- Search box that filters resources by name or tag
- Drag and drop to reorder resources and move them between categories
- Light and dark themes
- Edit mode - toggle it on from the user menu to add, edit, delete and rearrange things, then save when you're done
- Multi-user accounts with admin and regular user roles
- The first account created automatically becomes the admin
- User registration can be switched on or off from Settings
- Single sign-on login through any OIDC provider, including Keycloak
- Export everything to a JSON file and import it back in later, with a confirmation step before anything gets overwritten
- Icons for new resources are suggested automatically based on the name you type

## What you need

- Docker and Docker Compose installed on the machine you're deploying to

## Deploying it

1. Copy the example environment file:
   ```
   cp .env.example .env
   ```
2. Open `.env` and set a database password and a JWT secret (any random string works for both), and pick the port you want the dashboard to run on.
3. Start everything up:
   ```
   docker compose up -d --build
   ```
4. Open a browser to `http://<your-server-address>:<port>` (port 8083 by default).
5. Register an account. The first one you create automatically becomes the admin, and registration closes itself right after - you can turn it back on from Settings if you want other people to be able to sign up.

## Turning on single sign-on

Log in as admin, go to Settings > OIDC, and enter your provider's issuer URL, client ID and client secret. In your provider's settings, set the redirect URI to:
```
https://your-domain.com/api/auth/oidc/callback
```

## Backing up your data

The Settings page has an Export button that downloads all your categories, resources and uploaded images as a single JSON file. Use Import on a new instance to load that file back in - you'll get a confirmation prompt before it replaces anything.
