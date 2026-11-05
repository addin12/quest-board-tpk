-- What a player needs to know before asking for a seat (ADR-49): how long a session runs, where the characters come from, what to bring, which safety tools the
-- game uses, and whether the Game Master says it has nothing to warn about. `session_hours` 0 and the empty lists mean "not said" (games saved before this).
-- Additive with defaults: safe to apply before or after the code that uses it; apply it BEFORE the push, because the new code reads and writes these columns.
ALTER TABLE games ADD COLUMN session_hours INTEGER NOT NULL DEFAULT 0;
ALTER TABLE games ADD COLUMN characters TEXT NOT NULL DEFAULT '';
ALTER TABLE games ADD COLUMN needs TEXT NOT NULL DEFAULT '[]';
ALTER TABLE games ADD COLUMN safety_keys TEXT NOT NULL DEFAULT '[]';
ALTER TABLE games ADD COLUMN no_warnings INTEGER NOT NULL DEFAULT 0;
