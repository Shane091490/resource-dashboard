CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  password_hash TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  oidc_sub TEXT UNIQUE,
  oidc_issuer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  allow_registration BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO app_settings (id) VALUES (1);

CREATE TABLE oidc_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  provider_name TEXT NOT NULL DEFAULT 'SSO',
  issuer_url TEXT,
  client_id TEXT,
  client_secret_enc TEXT,
  redirect_uri TEXT,
  scopes TEXT NOT NULL DEFAULT 'openid email profile',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pages (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_home BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_categories_page ON categories(page_id, position);

CREATE TABLE resources (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image TEXT,
  url TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_resources_category ON resources(category_id, position);
CREATE INDEX idx_resources_tags ON resources USING GIN (tags);
CREATE INDEX idx_resources_name ON resources USING GIN (to_tsvector('simple', name));

INSERT INTO pages (name, slug, position, is_home) VALUES ('Home', 'home', 0, TRUE);
