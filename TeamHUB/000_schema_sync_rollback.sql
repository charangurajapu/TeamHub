-- =========================================================================
-- 000_schema_sync_rollback.sql
-- Rollback script for 000_schema_sync.sql.
-- =========================================================================
-- WARNING:
-- This script safely drops ONLY the specific columns and newly added indexes
-- introduced by 000_schema_sync.sql.
-- IT DESTROYS ANY DATA WRITTEN TO THOSE SPECIFIC COLUMNS AFTER THE SYNC SCRIPT
-- WAS APPLIED.
-- Pre-existing base tables (workspaces, profiles, tasks, channels) are NEVER
-- dropped to prevent catastrophic data loss.
-- =========================================================================

BEGIN;

-- 1. Drop indexes added by sync script (check existence first)
DROP INDEX IF EXISTS public.idx_channel_messages_channel_id;
DROP INDEX IF EXISTS public.idx_channel_messages_created_at;

-- 2. Drop additive columns on channels (check existence first)
ALTER TABLE IF EXISTS public.channels DROP COLUMN IF EXISTS is_protected;
ALTER TABLE IF EXISTS public.channels DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE IF EXISTS public.channels DROP COLUMN IF EXISTS deleted_by;

-- 3. Drop additive columns on tasks (check existence first)
ALTER TABLE IF EXISTS public.tasks DROP COLUMN IF EXISTS project_id;
ALTER TABLE IF EXISTS public.tasks DROP COLUMN IF EXISTS due_time;
ALTER TABLE IF EXISTS public.tasks DROP COLUMN IF EXISTS reviewer_id;

-- 4. Drop additive columns on projects (check existence first)
ALTER TABLE IF EXISTS public.projects DROP COLUMN IF EXISTS channel_id;

-- 5. Drop additive columns on profiles (check existence first)
ALTER TABLE IF EXISTS public.profiles DROP COLUMN IF EXISTS role_title;
ALTER TABLE IF EXISTS public.profiles DROP COLUMN IF EXISTS department;
ALTER TABLE IF EXISTS public.profiles DROP COLUMN IF EXISTS pod;
ALTER TABLE IF EXISTS public.profiles DROP COLUMN IF EXISTS pod_code;
ALTER TABLE IF EXISTS public.profiles DROP COLUMN IF EXISTS location;
ALTER TABLE IF EXISTS public.profiles DROP COLUMN IF EXISTS timezone;
ALTER TABLE IF EXISTS public.profiles DROP COLUMN IF EXISTS reporting_lead;
ALTER TABLE IF EXISTS public.profiles DROP COLUMN IF EXISTS theme;

-- 6. Drop additive columns on workspaces (check existence first)
ALTER TABLE IF EXISTS public.workspaces DROP COLUMN IF EXISTS description;
ALTER TABLE IF EXISTS public.workspaces DROP COLUMN IF EXISTS team_function;
ALTER TABLE IF EXISTS public.workspaces DROP COLUMN IF EXISTS is_active;

COMMIT;
