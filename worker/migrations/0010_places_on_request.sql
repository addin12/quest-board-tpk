-- An in-person game can be played in several places, and a game can have no fixed date (ADR-52). `cities` is a JSON list of places (`city` keeps the first one,
-- for everything that still reads one); `on_demand` = 1 is a game the Game Master runs when a group asks: `starts_at` is then only when it was listed. The
-- `repeat_days` column of migration 0009 is no longer written (ADR-51 was replaced by this one) and stays at 0.
-- Additive with defaults: safe to apply before or after the code that uses it; apply it BEFORE the push, because the new code reads and writes these columns.
ALTER TABLE games ADD COLUMN cities TEXT NOT NULL DEFAULT '[]';
ALTER TABLE games ADD COLUMN on_demand INTEGER NOT NULL DEFAULT 0;
