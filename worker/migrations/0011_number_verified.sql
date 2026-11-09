-- The WhatsApp number an admin has checked belongs to the Game Master (they sent a code from it). Holding the number itself, not a yes/no, means
-- a profile whose number is changed later is no longer verified: the check is `verified_whatsapp = whatsapp`.
ALTER TABLE profiles ADD COLUMN verified_whatsapp TEXT NOT NULL DEFAULT '';
