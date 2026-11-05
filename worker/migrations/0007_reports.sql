-- Publish first (ADR-48): a listing is live as soon as its Game Master saves it, so visitors can report one. A report keeps the kind and id of what was
-- reported, a hash of the reporter's address (never the address) and an optional short reason. One report per reporter per listing. Several reporters
-- hold the listing back for an admin's look; the admin's decision on it clears its reports. Additive: safe to apply before or after the code that uses it.
CREATE TABLE IF NOT EXISTS reports (
  id           TEXT PRIMARY KEY,
  subject_kind TEXT NOT NULL,
  subject_id   TEXT NOT NULL,
  reporter     TEXT NOT NULL,
  reason       TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS reports_once ON reports (subject_kind, subject_id, reporter);
CREATE INDEX IF NOT EXISTS reports_subject ON reports (subject_id);
