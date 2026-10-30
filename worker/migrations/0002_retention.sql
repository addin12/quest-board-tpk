-- Automatic expiry of inactive accounts (ADR-27): when someone last signed in, and when they were warned that the account will go.
ALTER TABLE accounts ADD COLUMN last_seen_at TEXT;
ALTER TABLE accounts ADD COLUMN expiry_warned_at TEXT;
UPDATE accounts SET last_seen_at = created_at WHERE last_seen_at IS NULL;
