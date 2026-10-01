-- =========================================================================
-- ROLLBACK 001c: RESTORE NOT NULL ON channel_messages.channel_slug
-- =========================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'channel_messages' 
      AND column_name = 'channel_slug'
  ) THEN
    -- Backfill any null channel_slug using the joined channels.slug
    UPDATE public.channel_messages m
    SET channel_slug = c.slug
    FROM public.channels c
    WHERE m.channel_id = c.id AND m.channel_slug IS NULL;

    -- Fallback for any messages without channel link
    UPDATE public.channel_messages SET channel_slug = 'general' WHERE channel_slug IS NULL;

    ALTER TABLE public.channel_messages ALTER COLUMN channel_slug SET NOT NULL;
  END IF;
END $$;

COMMIT;
