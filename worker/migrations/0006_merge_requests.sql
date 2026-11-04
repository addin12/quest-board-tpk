-- An admin no longer merges two profiles by one click: the merge is asked of the person whose account would absorb the other address, and
-- happens only when they accept it while signed in (ADR-45). A request is open for 7 days; the rows hold ids and the asking admin's
-- address, no personal data of a Game Master. Safe to apply before or after the code that uses it.
CREATE TABLE IF NOT EXISTS merge_requests (
  id TEXT PRIMARY KEY,
  from_profile_id TEXT NOT NULL,
  into_profile_id TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS merge_requests_into ON merge_requests (into_profile_id);
