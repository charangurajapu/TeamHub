-- =========================================================================
-- MIGRATION 001: CHANNELS UUID PRIMARY KEY & FOREIGN KEY REMAP (OPTION A)
-- Transactional, Idempotent, Safe Backfill & Quarantine
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- STEP 1: Create Quarantine Table for Unmappable Channel Messages
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quarantine_channel_messages (
  quarantine_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  original_message_id uuid NOT NULL,
  workspace_id uuid,
  channel_slug text,
  author_id uuid,
  content text,
  reactions jsonb,
  thread_replies_count int,
  created_at timestamptz,
  quarantined_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  quarantine_reason text NOT NULL
);

ALTER TABLE public.quarantine_channel_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view quarantine channel messages" ON public.quarantine_channel_messages;
CREATE POLICY "Admins can view quarantine channel messages"
  ON public.quarantine_channel_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- -------------------------------------------------------------------------
-- STEP 2: Upgrade channels table to use UUID primary key + unique slug
-- -------------------------------------------------------------------------

-- 2A. Add new UUID column if not present
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS uuid_id uuid DEFAULT gen_random_uuid();

-- Ensure all existing rows have a valid uuid
UPDATE public.channels SET uuid_id = gen_random_uuid() WHERE uuid_id IS NULL;
ALTER TABLE public.channels ALTER COLUMN uuid_id SET NOT NULL;

-- 2B. Add slug column and populate from text id if not already present
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS slug text;
UPDATE public.channels SET slug = id WHERE slug IS NULL;
ALTER TABLE public.channels ALTER COLUMN slug SET NOT NULL;

-- 2C. Clean up existing primary key constraint on channels(id)
-- If id is currently the PK, we swap PK to uuid_id
DO $$
DECLARE
  v_pk_name text;
BEGIN
  SELECT constraint_name INTO v_pk_name
  FROM information_schema.table_constraints
  WHERE table_schema = 'public' 
    AND table_name = 'channels' 
    AND constraint_type = 'PRIMARY KEY';

  IF v_pk_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.channels DROP CONSTRAINT ' || quote_ident(v_pk_name);
  END IF;
END $$;

-- 2D. Set uuid_id as the new PRIMARY KEY
ALTER TABLE public.channels ADD CONSTRAINT channels_pkey PRIMARY KEY (uuid_id);

-- 2E. Rename columns so uuid_id becomes id, and old text id is preserved as old_id (nullable)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'channels' AND column_name = 'id' AND data_type = 'text'
  ) THEN
    ALTER TABLE public.channels RENAME COLUMN id TO old_id;
    ALTER TABLE public.channels RENAME COLUMN uuid_id TO id;
  END IF;
  
  -- Ensure old_id is nullable for newly created channels
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'channels' AND column_name = 'old_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.channels ALTER COLUMN old_id DROP NOT NULL;
  END IF;
END $$;

-- 2F. Add Unique constraint on (workspace_id, slug)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'channels_workspace_slug_key'
  ) THEN
    ALTER TABLE public.channels ADD CONSTRAINT channels_workspace_slug_key UNIQUE (workspace_id, slug);
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- STEP 3: Upgrade channel_messages table
-- -------------------------------------------------------------------------

-- 3A. Rename existing text channel_id to channel_slug if it is text and ensure it is nullable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'channel_messages' AND column_name = 'channel_id' AND data_type = 'text'
  ) THEN
    ALTER TABLE public.channel_messages RENAME COLUMN channel_id TO channel_slug;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'channel_messages' AND column_name = 'channel_slug' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.channel_messages ALTER COLUMN channel_slug DROP NOT NULL;
  END IF;
END $$;

-- 3B. Add new channel_id as UUID column
ALTER TABLE public.channel_messages ADD COLUMN IF NOT EXISTS channel_id uuid;

-- 3C. Backfill channel_id by matching channels on (workspace_id, slug) or (slug)
UPDATE public.channel_messages m
SET channel_id = c.id
FROM public.channels c
WHERE (m.workspace_id IS NOT NULL AND c.workspace_id = m.workspace_id AND lower(c.slug) = lower(m.channel_slug))
   OR (m.workspace_id IS NULL AND lower(c.slug) = lower(m.channel_slug));

-- 3D. Quarantine any unmapped messages that could not match an existing channel
INSERT INTO public.quarantine_channel_messages (
  original_message_id,
  workspace_id,
  channel_slug,
  author_id,
  content,
  reactions,
  thread_replies_count,
  created_at,
  quarantine_reason
)
SELECT 
  m.id,
  m.workspace_id,
  m.channel_slug,
  m.author_id,
  m.content,
  m.reactions,
  m.thread_replies_count,
  m.created_at,
  'No matching channel found for slug: ' || coalesce(m.channel_slug, 'NULL')
FROM public.channel_messages m
WHERE m.channel_id IS NULL;

-- Remove quarantined rows from active table
DELETE FROM public.channel_messages WHERE channel_id IS NULL;

-- 3E. Enforce NOT NULL and Foreign Key on channel_messages.channel_id
ALTER TABLE public.channel_messages ALTER COLUMN channel_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_channel_messages_channel'
  ) THEN
    ALTER TABLE public.channel_messages 
      ADD CONSTRAINT fk_channel_messages_channel 
      FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- STEP 4: Remap projects.channel_id to UUID
-- -------------------------------------------------------------------------

-- 4A. Add channel_slug column on projects and backup current text channel_id
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS channel_slug text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'channel_id' AND data_type = 'text'
  ) THEN
    UPDATE public.projects SET channel_slug = channel_id WHERE channel_slug IS NULL;
    ALTER TABLE public.projects RENAME COLUMN channel_id TO old_channel_id;
    ALTER TABLE public.projects ADD COLUMN channel_id uuid;
  END IF;
END $$;

-- 4B. Backfill projects.channel_id with UUID matching channel slug / old text
UPDATE public.projects p
SET channel_id = c.id
FROM public.channels c
WHERE (p.workspace_id IS NOT NULL AND c.workspace_id = p.workspace_id AND (lower(c.slug) = lower(p.channel_slug) OR lower(c.old_id) = lower(p.channel_slug)))
   OR (lower(c.slug) = lower(p.channel_slug) OR lower(c.old_id) = lower(p.channel_slug));

-- 4C. Add Foreign Key constraint for projects.channel_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_projects_channel'
  ) THEN
    ALTER TABLE public.projects 
      ADD CONSTRAINT fk_projects_channel 
      FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE SET NULL;
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- STEP 5: Functions & Triggers for Default Channels Creation
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_default_workspace_channels(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert #general channel
  INSERT INTO public.channels (id, workspace_id, name, slug, description, is_mandatory, is_protected)
  VALUES (
    gen_random_uuid(),
    p_workspace_id,
    'general',
    'general',
    'Company-wide discussions, announcements, and sprint kickoffs.',
    true,
    true
  )
  ON CONFLICT (workspace_id, slug) DO NOTHING;

  -- Insert #design channel
  INSERT INTO public.channels (id, workspace_id, name, slug, description, is_mandatory, is_protected)
  VALUES (
    gen_random_uuid(),
    p_workspace_id,
    'design',
    'design',
    'Design review, Figma specs, and tokens architecture.',
    false,
    false
  )
  ON CONFLICT (workspace_id, slug) DO NOTHING;
END;
$$;

-- -------------------------------------------------------------------------
-- STEP 6: Update RLS Policies & Indexes on Channels and Messages
-- -------------------------------------------------------------------------

-- 6A. Indexes
CREATE INDEX IF NOT EXISTS idx_channels_workspace_id ON public.channels(workspace_id);
CREATE INDEX IF NOT EXISTS idx_channels_slug ON public.channels(slug);
CREATE INDEX IF NOT EXISTS idx_channel_messages_channel_id ON public.channel_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_messages_workspace_created ON public.channel_messages(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_projects_channel_id ON public.projects(channel_id);

-- 6B. Channels RLS Policies (supporting uuid id + slug)
DROP POLICY IF EXISTS "Channels viewable by authenticated workspace members" ON public.channels;
CREATE POLICY "Channels viewable by authenticated workspace members"
  ON public.channels FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (deleted_at IS NULL OR public.current_user_role() IN ('admin', 'lead'))
    AND (
      workspace_id IS NULL 
      OR workspace_id = public.current_user_workspace_id()
      OR public.current_user_role() = 'admin'
    )
  );

DROP POLICY IF EXISTS "Channels insertable by admins or leads" ON public.channels;
CREATE POLICY "Channels insertable by admins or leads"
  ON public.channels FOR INSERT
  WITH CHECK (
    public.current_user_role() IN ('admin', 'lead')
    AND (
      workspace_id IS NULL 
      OR workspace_id = public.current_user_workspace_id()
      OR public.current_user_role() = 'admin'
    )
  );

DROP POLICY IF EXISTS "Channels updatable by admins or leads" ON public.channels;
CREATE POLICY "Channels updatable by admins or leads"
  ON public.channels FOR UPDATE
  USING (
    public.current_user_role() IN ('admin', 'lead')
    AND lower(slug) != 'general'
    AND coalesce(is_protected, false) = false
    AND (
      workspace_id IS NULL 
      OR workspace_id = public.current_user_workspace_id()
      OR public.current_user_role() = 'admin'
    )
  )
  WITH CHECK (
    public.current_user_role() IN ('admin', 'lead')
    AND lower(slug) != 'general'
    AND coalesce(is_protected, false) = false
  );

DROP POLICY IF EXISTS "Channels deletable by admins or leads" ON public.channels;
CREATE POLICY "Channels deletable by admins or leads"
  ON public.channels FOR DELETE
  USING (
    public.current_user_role() IN ('admin', 'lead')
    AND lower(slug) != 'general'
    AND coalesce(is_protected, false) = false
    AND (
      workspace_id IS NULL 
      OR workspace_id = public.current_user_workspace_id()
      OR public.current_user_role() = 'admin'
    )
  );

-- 6C. Channel Messages RLS Policies
DROP POLICY IF EXISTS "Messages viewable by authenticated workspace members" ON public.channel_messages;
CREATE POLICY "Messages viewable by authenticated workspace members"
  ON public.channel_messages FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      workspace_id IS NULL 
      OR workspace_id = public.current_user_workspace_id()
      OR public.current_user_role() = 'admin'
    )
  );

DROP POLICY IF EXISTS "Messages insertable by active author" ON public.channel_messages;
CREATE POLICY "Messages insertable by active author"
  ON public.channel_messages FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND (
      workspace_id IS NULL 
      OR workspace_id = public.current_user_workspace_id()
      OR public.current_user_role() = 'admin'
    )
  );

DROP POLICY IF EXISTS "Messages updateable by author or admin" ON public.channel_messages;
CREATE POLICY "Messages updateable by author or admin"
  ON public.channel_messages FOR UPDATE
  USING (
    auth.uid() = author_id
    OR public.current_user_role() = 'admin'
  );

COMMIT;
