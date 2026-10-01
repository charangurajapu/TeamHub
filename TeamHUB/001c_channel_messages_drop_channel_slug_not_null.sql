-- =========================================================================
-- MIGRATION 001c: DROP NOT NULL ON channel_messages.channel_slug
-- Transactional, Idempotent Hotfix
-- Allows new channel messages to reference channels via UUID channel_id
-- without requiring the legacy text slug in channel_slug.
-- =========================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'channel_messages' 
      AND column_name = 'channel_slug' 
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.channel_messages ALTER COLUMN channel_slug DROP NOT NULL;
  END IF;
END $$;

COMMIT;
