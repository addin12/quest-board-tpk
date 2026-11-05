-- A game that meets again and again (ADR-51): `repeat_days` is 0 (one session) or 7, 14 or 28 (it meets again that many days after each session). `starts_at` stays the
-- first session; the public data shows the NEXT one. `nudged_at` records the one email a Game Master gets before such a listing stops being shown.
-- Additive with defaults: safe to apply before or after the code that uses it; apply it BEFORE the push, because the new code reads and writes these columns.
ALTER TABLE games ADD COLUMN repeat_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE games ADD COLUMN nudged_at TEXT NOT NULL DEFAULT '';
