-- =========================================================================
-- 002_tasks_projects_foreign_key_rollback.sql
-- Transactional Rollback for Migration 002
--
-- Reverts:
-- 1. Drops fk_tasks_project constraint and idx_tasks_project_id
-- 2. Converts tasks.project_id back to text
-- 3. Drops fk_project_members_project constraint and indexes
-- 4. Converts project_members.project_id back to text
-- =========================================================================

BEGIN;

-- 1. Revert tasks.project_id
DO $$
BEGIN
  -- Drop Foreign Key constraint
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tasks_project'
  ) THEN
    ALTER TABLE public.tasks DROP CONSTRAINT fk_tasks_project;
  END IF;

  -- Convert column type back to text
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'tasks' 
      AND column_name = 'project_id' 
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.tasks 
      ALTER COLUMN project_id TYPE text USING (project_id::text);
  END IF;
END $$;

DROP INDEX IF EXISTS public.idx_tasks_project_id;


-- 2. Revert project_members.project_id
DO $$
DECLARE
  v_pm_pk text;
BEGIN
  -- Drop Foreign Key constraint
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_members_project'
  ) THEN
    ALTER TABLE public.project_members DROP CONSTRAINT fk_project_members_project;
  END IF;

  -- Drop PK constraint temporarily to allow type alteration
  SELECT constraint_name INTO v_pm_pk
  FROM information_schema.table_constraints
  WHERE table_schema = 'public' 
    AND table_name = 'project_members' 
    AND constraint_type = 'PRIMARY KEY';

  IF v_pm_pk IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.project_members DROP CONSTRAINT ' || quote_ident(v_pm_pk);
  END IF;

  -- Convert column type back to text
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'project_members' 
      AND column_name = 'project_id' 
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.project_members 
      ALTER COLUMN project_id TYPE text USING (project_id::text);
  END IF;

  -- Re-add PK
  ALTER TABLE public.project_members 
    ADD CONSTRAINT project_members_pkey PRIMARY KEY (project_id, user_id);
END $$;

DROP INDEX IF EXISTS public.idx_project_members_project_id;
DROP INDEX IF EXISTS public.idx_project_members_user_id;

COMMIT;
