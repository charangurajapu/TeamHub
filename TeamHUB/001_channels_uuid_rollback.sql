-- =========================================================================
-- ROLLBACK FOR MIGRATION 001: CHANNELS UUID PRIMARY KEY & FOREIGN KEY REMAP
-- Reverts channels, channel_messages, projects back to text channel ID schema
-- =========================================================================

BEGIN;

-- 1. Drop foreign key constraints
ALTER TABLE IF EXISTS public.channel_messages DROP CONSTRAINT IF EXISTS fk_channel_messages_channel;
ALTER TABLE IF EXISTS public.projects DROP CONSTRAINT IF EXISTS fk_projects_channel;

-- 2. Restore projects.channel_id as text
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'old_channel_id'
  ) THEN
    ALTER TABLE public.projects DROP COLUMN IF EXISTS channel_id;
    ALTER TABLE public.projects RENAME COLUMN old_channel_id TO channel_id;
  END IF;
END $$;

-- 3. Restore unquarantined messages back to channel_messages
INSERT INTO public.channel_messages (
  id,
  workspace_id,
  channel_slug,
  author_id,
  content,
  reactions,
  thread_replies_count,
  created_at
)
SELECT 
  original_message_id,
  workspace_id,
  channel_slug,
  author_id,
  content,
  reactions,
  thread_replies_count,
  created_at
FROM public.quarantine_channel_messages
ON CONFLICT (id) DO NOTHING;

-- 4. Restore channel_messages.channel_id as text slug
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'channel_messages' AND column_name = 'channel_slug'
  ) THEN
    ALTER TABLE public.channel_messages DROP COLUMN IF EXISTS channel_id;
    ALTER TABLE public.channel_messages RENAME COLUMN channel_slug TO channel_id;
  END IF;
END $$;

-- 5. Restore channels table text primary key
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'channels' AND column_name = 'old_id'
  ) THEN
    ALTER TABLE public.channels DROP CONSTRAINT IF EXISTS channels_pkey;
    ALTER TABLE public.channels DROP CONSTRAINT IF EXISTS channels_workspace_slug_key;
    ALTER TABLE public.channels DROP COLUMN IF EXISTS id;
    ALTER TABLE public.channels RENAME COLUMN old_id TO id;
    ALTER TABLE public.channels ADD CONSTRAINT channels_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- 6. Clean up quarantine table
DROP TABLE IF EXISTS public.quarantine_channel_messages;

COMMIT;
