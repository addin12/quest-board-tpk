-- Game mechanics (the dice or cards behind the rules): a list of keys from src/lib/categories.ts, stored like styles.
ALTER TABLE games ADD COLUMN mechanics TEXT NOT NULL DEFAULT '[]';
