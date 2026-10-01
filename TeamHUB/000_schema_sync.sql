-- =========================================================================
-- 000_schema_sync.sql
-- Idempotent, Transactional, Non-destructive schema baseline sync for TeamHub.
-- Brings the live database up to the structure defined in supabase_schema.sql.
-- Modifies NO existing data, alters NO types, alters NO policies.
-- =========================================================================

-- =========================================================================
-- TABLE CREATION & DRIFT AUDIT SUMMARY:
-- -------------------------------------------------------------------------
-- Based on the diagnostic check against the live Supabase database:
--
-- ALREADY PRESENT TABLES:
--   1. public.workspaces (confirmed present in live DB with 3 existing records)
--   2. public.profiles   (confirmed present in live DB)
--   3. public.channels   (confirmed present in live DB, but missing columns)
--   4. public.tasks      (confirmed present in live DB, but missing columns)
--
-- NEWLY CREATED TABLES (IF NOT ALREADY PRESENT):
--   5. public.projects          (Created if not exists, RLS enabled)
--   6. public.project_members   (Created if not exists, RLS enabled)
--   7. public.channel_messages  (Created if not exists, RLS enabled)
--   8. public.questions         (Created if not exists, RLS enabled)
--   9. public.question_answers  (Created if not exists, RLS enabled)
--  10. public.workspace_files   (Created if not exists, RLS enabled)
--  11. public.join_requests     (Created if not exists, RLS enabled)
--  12. public.reviews           (Created if not exists, RLS enabled)
--
-- COMPLETE LIST OF ADDITIVE COLUMNS APPLIED (IF NOT ALREADY PRESENT):
--   - channels.description       text DEFAULT ''
--   - channels.is_mandatory     boolean DEFAULT false
--   - channels.is_protected     boolean DEFAULT false
--   - channels.deleted_at       timestamptz DEFAULT null
--   - channels.deleted_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL
--   - tasks.project_id          text
--   - tasks.due_time            text
--   - tasks.reviewer_id         uuid REFERENCES public.profiles(id) ON DELETE SET NULL
--   - projects.channel_id       text
--   - projects.pod_id           text NOT NULL DEFAULT 'core'
--   - projects.pod              text NOT NULL DEFAULT 'Core Engineering'
--   - workspaces.description    text DEFAULT ''
--   - workspaces.team_function  text DEFAULT 'engineering'
--   - workspaces.is_active      boolean DEFAULT true
--   - profiles.role_title       text DEFAULT 'Team Member'
--   - profiles.department       text DEFAULT 'Engineering'
--   - profiles.pod              text DEFAULT 'Core Engineering Pod'
--   - profiles.pod_code         text
--   - profiles.location         text DEFAULT 'San Francisco, CA'
--   - profiles.timezone         text DEFAULT 'UTC-7 (PDT)'
--   - profiles.reporting_lead   text DEFAULT 'David Kim'
--   - profiles.theme            text DEFAULT 'light'
--
-- INDEXES APPLIED (IF NOT ALREADY PRESENT):
--   - idx_channel_messages_channel_id on channel_messages(channel_id)
--   - idx_channel_messages_created_at on channel_messages(created_at)
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- STEP 1: Core Tables in Dependency Order (workspaces -> profiles)
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text DEFAULT '',
  team_function text DEFAULT 'engineering',
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_email text NOT NULL,
  pod_code text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS team_function text DEFAULT 'engineering';
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'lead', 'admin')),
  role_title text DEFAULT 'Team Member',
  department text DEFAULT 'Engineering',
  pod text DEFAULT 'Core Engineering Pod',
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  pod_code text,
  avatar_url text,
  location text DEFAULT 'San Francisco, CA',
  timezone text DEFAULT 'UTC-7 (PDT)',
  phone text,
  date_of_birth text,
  date_joined timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  reporting_lead text DEFAULT 'David Kim',
  bio varchar(200),
  skills text[] DEFAULT '{"Engineering"}',
  social_links jsonb DEFAULT '{"github": "", "linkedin": "", "portfolio": ""}'::jsonb,
  notification_preferences jsonb DEFAULT '{"directMentions": true, "taskStatusChanges": true, "qnaReplies": false}'::jsonb,
  theme text DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
  tasks_completed int DEFAULT 0,
  questions_answered int DEFAULT 0,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role_title text DEFAULT 'Team Member';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department text DEFAULT 'Engineering';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pod text DEFAULT 'Core Engineering Pod';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pod_code text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location text DEFAULT 'San Francisco, CA';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC-7 (PDT)';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reporting_lead text DEFAULT 'David Kim';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme text DEFAULT 'light';

-- -------------------------------------------------------------------------
-- STEP 2: Projects & Project Members
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  target_date text NOT NULL,
  pod_id text NOT NULL DEFAULT 'core',
  pod text NOT NULL DEFAULT 'Core Engineering',
  status text NOT NULL DEFAULT 'on_track' CHECK (status IN ('on_track', 'at_risk', 'completed', 'blocked')),
  channel_id text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS channel_id text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS pod_id text NOT NULL DEFAULT 'core';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS pod text NOT NULL DEFAULT 'Core Engineering';

CREATE TABLE IF NOT EXISTS public.project_members (
  project_id text NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'contributor',
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (project_id, user_id)
);
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- STEP 3: Tasks Table
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id text,
  key text NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  channel text DEFAULT '#backend',
  sprint text DEFAULT 'Sprint 42',
  assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date text,
  due_time text,
  subtasks jsonb DEFAULT '[]'::jsonb,
  attachments jsonb DEFAULT '[]'::jsonb,
  comments jsonb DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS project_id text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS due_time text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS reviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- -------------------------------------------------------------------------
-- STEP 4: Channels & Channel Messages Tables
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.channels (
  id text PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  is_mandatory boolean DEFAULT false,
  is_protected boolean DEFAULT false,
  deleted_at timestamptz DEFAULT null,
  deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS is_mandatory boolean DEFAULT false;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS is_protected boolean DEFAULT false;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT null;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.channel_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel_id text NOT NULL,
  author_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  reactions jsonb DEFAULT '[]'::jsonb,
  thread_replies_count int DEFAULT 0,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_channel_messages_channel_id ON public.channel_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_messages_created_at ON public.channel_messages(created_at);

-- -------------------------------------------------------------------------
-- STEP 5: Questions & Question Answers Tables
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  key text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  author_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  tags text[] DEFAULT '{}',
  channel text DEFAULT '#backend',
  status text DEFAULT 'open' CHECK (status IN ('open', 'answered', 'resolved')),
  views int DEFAULT 1,
  upvotes int DEFAULT 1,
  code_snippet jsonb,
  ai_summary text,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.question_answers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  author_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  upvotes int DEFAULT 1,
  is_accepted boolean DEFAULT false,
  is_ai_suggested boolean DEFAULT false,
  code_block jsonb,
  tip_box jsonb,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.question_answers ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- STEP 6: Workspace Files Table
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.workspace_files (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  size text NOT NULL,
  folder text DEFAULT 'Sprint Deliverables',
  uploader_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  preview_url text,
  url text,
  tags text[] DEFAULT '{}',
  ai_summary text,
  linked_task text,
  dimensions text,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.workspace_files ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- STEP 7: Join Requests Table
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.join_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('member', 'lead', 'admin')),
  department text DEFAULT 'Engineering',
  avatar_initials text DEFAULT 'TU',
  requested_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- STEP 8: Reviews Table
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  reviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assignee_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'changes_requested', 'rejected')),
  feedback text DEFAULT '',
  branch text DEFAULT '',
  pr_number text DEFAULT '',
  lines_added int DEFAULT 0,
  lines_removed int DEFAULT 0,
  files_changed int DEFAULT 0,
  safe_to_merge boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  reviewed_at timestamptz
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

COMMIT;
