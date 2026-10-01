-- =========================================================================
-- ROLLBACK 001b: RESTORE NOT NULL ON channels.old_id
-- =========================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'channels' 
      AND column_name = 'old_id'
  ) THEN
    -- Backfill any channels created without old_id using their slug
    UPDATE public.channels SET old_id = slug WHERE old_id IS NULL;
    ALTER TABLE public.channels ALTER COLUMN old_id SET NOT NULL;
  END IF;
END $$;

COMMIT;
