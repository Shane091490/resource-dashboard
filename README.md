# Resource Dashboard

A self-hosted dashboard for organizing links to all the apps and services you run. Add resources with a name, description, tags and an icon, group them into categories, and search across everything from one screen.

## Screenshot
<img width="1906" height="837" alt="image" src="https://github.com/user-attachments/assets/a4dfb016-9d03-4ffa-ab52-f27d5f4d292d" />
<img width="1906" height="837" alt="image" src="https://github.com/user-attachments/assets/e40db467-26d8-4b0d-be37-490ca06e4345" />
<img width="1906" height="837" alt="image" src="https://github.com/user-attachments/assets/c2fbf794-2c2d-4df7-b089-5587d861e3b1" />
<img width="1888" height="863" alt="image" src="https://github.com/user-attachments/assets/dd765767-c2c3-4eb4-ad82-2820dc0b80dc" />
<img width="1900" height="877" alt="image" src="https://github.com/user-attachments/assets/0af1b606-a20b-4ca7-9d65-3f8bec0033fb" />


## Features

- Category cards holding your resource links, arranged on a responsive dashboard
- Multiple pages, each with its own button in the top navigation
- Search box that filters resources by name or tag
- Drag and drop to reorder categories/resources
- Light and dark themes
- Edit mode - toggle it on from the user menu to add, edit, delete and rearrange things, then save when you're done
- Multi-user accounts with admin and regular user roles
- The first account created automatically becomes the admin
- User registration can be switched on or off from Settings
- Single sign-on login through any OIDC provider, including Keycloak
- Export everything to a JSON file and import it back in later, with a confirmation step before anything gets overwritten
- Icons for new resources are suggested automatically based on the name you type
- Pull in resources straight from Pangolin, sorted into categories automatically, with an optional switch to keep adding newly created ones on their own

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
5. Register an account. The first one you create automatically becomes the admin, and registration closes itself right after - you can turn it back on from Settings if you want other people to be able to register an account.

## Turning on single sign-on

Log in as admin, go to Settings > OIDC, and enter your provider's issuer URL, client ID and client secret. In your provider's settings, set the redirect URI to:
```
https://your-domain.com/api/auth/oidc/callback
```

## Importing from Pangolin

If you expose services publicly through Pangolin, you can pull them all in as resource cards instead of adding each one by hand. Log in as admin, go to Settings > Pangolin import, and enter the address and API key for Pangolin's Integration API - this is a separate address from your regular Pangolin dashboard and has to be turned on and given its own address first (the page links to Pangolin's own documentation for that part). Click Import now to bring everything in right away, or turn on auto-sync to have it check every few minutes and add any newly created ones by itself. Each resource is sorted into a category based on what kind of app it looks like (media server, monitoring tool, and so on), with anything it doesn't recognize landing in a general category.

## Backing up your data

The Settings page has an Export button that downloads all your categories, resources and uploaded images as a single JSON file. Use Import on a new instance to load that file back in - you'll get a confirmation prompt before it replaces anything.
