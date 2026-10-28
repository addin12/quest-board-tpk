-- Quest Board TPK on Cloudflare D1 (SQLite). Applied with: wrangler d1 migrations apply quest-board
-- One verified email is one account; an account has at most one profile (the GM) and any number of games.

CREATE TABLE accounts (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,          -- normalised (lower case, Gmail dots and +tags removed)
  created_at  TEXT NOT NULL,
  merged_into TEXT REFERENCES accounts(id)   -- set when an admin merges a duplicate account into another
);

-- A one-time sign-in link. Only the SHA-256 of the token is stored.
CREATE TABLE login_tokens (
  token_hash TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at    TEXT
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX sessions_account ON sessions(account_id);

CREATE TABLE profiles (
  id            TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL UNIQUE REFERENCES accounts(id),
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  bio           TEXT NOT NULL DEFAULT '',
  city          TEXT NOT NULL DEFAULT '',     -- a Jabodetabek area, or "Online only"
  systems       TEXT NOT NULL DEFAULT '[]',   -- JSON array of text
  whatsapp      TEXT NOT NULL,                -- digits with country code
  discord       TEXT NOT NULL DEFAULT '',
  photo_key     TEXT NOT NULL DEFAULT '',     -- R2 key
  consent       INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note    TEXT NOT NULL DEFAULT '',
  reviewed_by   TEXT NOT NULL DEFAULT '',
  reviewed_at   TEXT NOT NULL DEFAULT '',
  reject_reason TEXT NOT NULL DEFAULT '',
  was_live      INTEGER NOT NULL DEFAULT 0,   -- approved at least once: its address keeps a "no longer listed" page
  gone_at       TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX profiles_whatsapp ON profiles(whatsapp);

CREATE TABLE games (
  id              TEXT PRIMARY KEY,
  profile_id      TEXT NOT NULL REFERENCES profiles(id),
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  system          TEXT NOT NULL,
  summary         TEXT NOT NULL,              -- the short description, at most 80 characters
  description     TEXT NOT NULL,              -- the long one
  format          TEXT NOT NULL CHECK (format IN ('one_shot', 'campaign')),
  location_type   TEXT NOT NULL CHECK (location_type IN ('online', 'in_person')),
  platform        TEXT NOT NULL DEFAULT '',
  city            TEXT NOT NULL DEFAULT '',
  venue_name      TEXT NOT NULL DEFAULT '',
  venue_maps_raw  TEXT NOT NULL DEFAULT '',
  starts_at       TEXT NOT NULL,              -- ISO 8601 UTC
  zone            TEXT NOT NULL CHECK (zone IN ('WIB', 'WITA', 'WIT')),
  schedule_note   TEXT NOT NULL DEFAULT '',
  expires_at      TEXT NOT NULL,
  price_idr       INTEGER NOT NULL DEFAULT 0,
  seats           INTEGER NOT NULL,
  language        TEXT NOT NULL CHECK (language IN ('id', 'en', 'both')),
  level           TEXT NOT NULL CHECK (level IN ('beginner', 'any', 'experienced')),
  min_age         INTEGER NOT NULL DEFAULT 0,
  content_warnings TEXT NOT NULL DEFAULT '',
  safety_tools    TEXT NOT NULL DEFAULT '',
  genres          TEXT NOT NULL DEFAULT '[]',
  styles          TEXT NOT NULL DEFAULT '[]',
  cover_key       TEXT NOT NULL DEFAULT '',   -- R2 key
  consent         INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  featured        INTEGER NOT NULL DEFAULT 0,
  full            INTEGER NOT NULL DEFAULT 0,
  admin_note      TEXT NOT NULL DEFAULT '',
  reviewed_by     TEXT NOT NULL DEFAULT '',
  reviewed_at     TEXT NOT NULL DEFAULT '',
  reject_reason   TEXT NOT NULL DEFAULT '',
  was_live        INTEGER NOT NULL DEFAULT 0,
  gone_at         TEXT NOT NULL DEFAULT '',   -- set when the GM removes the game
  removed         INTEGER NOT NULL DEFAULT 0, -- removed by its GM: off the site, out of the admin queue
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX games_profile ON games(profile_id);
CREATE INDEX games_status ON games(status);

CREATE TABLE admins (
  email    TEXT PRIMARY KEY,
  added_by TEXT NOT NULL,
  added_at TEXT NOT NULL
);

-- The audit trail: every decision, change, sign-in request outcome and merge.
CREATE TABLE activity (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  at           TEXT NOT NULL,
  kind         TEXT NOT NULL,
  subject_kind TEXT NOT NULL DEFAULT '',
  subject_id   TEXT NOT NULL DEFAULT '',
  title        TEXT NOT NULL DEFAULT '',
  detail       TEXT NOT NULL DEFAULT '',
  actor        TEXT NOT NULL DEFAULT ''
);

-- Counters for the sign-in and submit limits (a sliding window per key).
CREATE TABLE rate_events (
  key TEXT NOT NULL,
  at  INTEGER NOT NULL                        -- milliseconds since the epoch
);
CREATE INDEX rate_key ON rate_events(key, at);

-- Small key/value state: the last deploy time and whether the site is behind.
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
