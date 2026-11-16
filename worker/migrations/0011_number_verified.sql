-- UNUSED since ADR-62 (2026-11-16): the WhatsApp number verification this column was made for was dropped. The column stays because it is already in the live
-- database and so in every nightly backup: a restore loads each row with its column names, and a database without the column would refuse them.
ALTER TABLE profiles ADD COLUMN verified_whatsapp TEXT NOT NULL DEFAULT '';
