-- A change to something already approved no longer takes the approved version off the site (ADR-48): the new version waits in `draft` (JSON of
-- every editable column) with `draft_state` 'pending' or 'rejected' until an admin decides; the approved columns keep serving the site. Empty
-- strings mean "no draft". Additive with defaults: the code that is live keeps working after this is applied, and the new code needs it,
-- so apply it BEFORE the push that carries the new code (`npm run cloudflare:setup` applies it).
ALTER TABLE games ADD COLUMN draft TEXT NOT NULL DEFAULT '';
ALTER TABLE games ADD COLUMN draft_state TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN draft TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN draft_state TEXT NOT NULL DEFAULT '';
