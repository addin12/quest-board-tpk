-- The picture lookup for /api/img/<key> asks "is this file on an approved row?" for any key a visitor sends; without an index each
-- miss scanned both tables. Safe to apply before or after the code that relies on it.
CREATE INDEX IF NOT EXISTS profiles_photo_key ON profiles (photo_key);
CREATE INDEX IF NOT EXISTS games_cover_key ON games (cover_key);
