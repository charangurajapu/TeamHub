-- =========================================================================
-- MIGRATION 001b: DROP NOT NULL ON channels.old_id
-- Transactional, Idempotent Hotfix
-- Allows new channels to be created with UUID primary keys without requiring
-- legacy text slug in the archived old_id column.
-- =========================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'channels' 
      AND column_name = 'old_id' 
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.channels ALTER COLUMN old_id DROP NOT NULL;
  END IF;
END $$;

COMMIT;
