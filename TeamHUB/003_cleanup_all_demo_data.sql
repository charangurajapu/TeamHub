-- =========================================================================
-- 003_cleanup_all_demo_data.sql
-- Clean all demo/test data from the database at the data level ONLY.
-- Preserves ALL tables, schema definitions, indexes, RLS policies, triggers, and functions.
--
-- Target tables cleaned (all 13 tables + auth.users):
--   1. public.project_members
--   2. public.reviews
--   3. public.workspace_files
--   4. public.question_answers
--   5. public.questions
--   6. public.tasks
--   7. public.channel_messages
--   8. public.quarantine_channel_messages
--   9. public.channels
--  10. public.projects
--  11. public.join_requests
--  12. public.workspaces
--  13. auth.users (cascades to public.profiles) & public.profiles
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- STEP 1: Truncate Application Child / Dependent Tables
-- -------------------------------------------------------------------------
TRUNCATE TABLE public.project_members CASCADE;
TRUNCATE TABLE public.reviews CASCADE;
TRUNCATE TABLE public.workspace_files CASCADE;
TRUNCATE TABLE public.question_answers CASCADE;
TRUNCATE TABLE public.questions CASCADE;
TRUNCATE TABLE public.tasks CASCADE;
TRUNCATE TABLE public.channel_messages CASCADE;
TRUNCATE TABLE public.quarantine_channel_messages CASCADE;
TRUNCATE TABLE public.channels CASCADE;
TRUNCATE TABLE public.projects CASCADE;
TRUNCATE TABLE public.join_requests CASCADE;

-- -------------------------------------------------------------------------
-- STEP 2: Clear Workspaces
-- -------------------------------------------------------------------------
TRUNCATE TABLE public.workspaces CASCADE;

-- -------------------------------------------------------------------------
-- STEP 3: Clear Auth Users (Cascades to public.profiles) & Profiles
-- -------------------------------------------------------------------------
-- Since public.profiles.id REFERENCES auth.users(id) ON DELETE CASCADE,
-- deleting auth.users automatically wipes the corresponding profiles.
DELETE FROM auth.users;

-- Ensure public.profiles is completely empty
DELETE FROM public.profiles;

COMMIT;

-- =========================================================================
-- VERIFICATION QUERY: Verify row counts across all tables
-- =========================================================================
SELECT 'workspaces' AS table_name, count(*) AS row_count FROM public.workspaces
UNION ALL
SELECT 'profiles', count(*) FROM public.profiles
UNION ALL
SELECT 'auth.users', count(*) FROM auth.users
UNION ALL
SELECT 'projects', count(*) FROM public.projects
UNION ALL
SELECT 'project_members', count(*) FROM public.project_members
UNION ALL
SELECT 'tasks', count(*) FROM public.tasks
UNION ALL
SELECT 'channels', count(*) FROM public.channels
UNION ALL
SELECT 'channel_messages', count(*) FROM public.channel_messages
UNION ALL
SELECT 'quarantine_channel_messages', count(*) FROM public.quarantine_channel_messages
UNION ALL
SELECT 'questions', count(*) FROM public.questions
UNION ALL
SELECT 'question_answers', count(*) FROM public.question_answers
UNION ALL
SELECT 'workspace_files', count(*) FROM public.workspace_files
UNION ALL
SELECT 'join_requests', count(*) FROM public.join_requests
UNION ALL
SELECT 'reviews', count(*) FROM public.reviews;
