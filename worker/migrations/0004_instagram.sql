-- A Game Master's Instagram username (optional), kept plain: lower case, no @, no link (cleanInstagram in src/lib/public-data.ts).
ALTER TABLE profiles ADD COLUMN instagram TEXT NOT NULL DEFAULT '';
