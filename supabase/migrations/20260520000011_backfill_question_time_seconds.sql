-- Backfill time_seconds = 10 for any questions where it was never set.
-- Prevents COALESCE from falling through to session default unexpectedly.
UPDATE questions SET time_seconds = 10 WHERE time_seconds IS NULL;

-- Also ensure the column has a default going forward.
ALTER TABLE questions ALTER COLUMN time_seconds SET DEFAULT 10;
