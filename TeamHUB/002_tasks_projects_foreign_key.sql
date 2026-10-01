-- =========================================================================
-- 002_tasks_projects_foreign_key.sql
-- Transactional, Idempotent Migration: Tasks & Project Members Foreign Keys
--
-- Summary of Changes:
-- 1. tasks.project_id:
--    - Cleans non-UUID text strings (sets to NULL)
--    - Converts column type from 'text' to 'uuid'
--    - Enforces Foreign Key: fk_tasks_project REFERENCES projects(id) ON DELETE SET NULL
--    - Adds index idx_tasks_project_id
-- 2. project_members.project_id:
--    - Cleans non-UUID text strings and deletes unmappable orphan references
--    - Converts column type from 'text' to 'uuid'
--    - Enforces Foreign Key: fk_project_members_project REFERENCES projects(id) ON DELETE CASCADE
--    - Adds index idx_project_members_project_id
--    - Adds RLS policies for authenticated project member access and lead/admin management
-- 3. channels:
--    - Sets is_protected = true on #general channel
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- STEP 1: tasks.project_id Conversion & Foreign Key Enforcement
-- -------------------------------------------------------------------------

DO $$
BEGIN
  -- 1A. If tasks.project_id is currently text, sanitize and cast to uuid
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'tasks' 
      AND column_name = 'project_id' 
      AND data_type = 'text'
  ) THEN
    -- Set any invalid / non-UUID text values to NULL before conversion
    UPDATE public.tasks 
    SET project_id = NULL 
    WHERE project_id IS NOT NULL 
      AND project_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

    -- Also nullify any references that do not exist in projects table
    UPDATE public.tasks t
    SET project_id = NULL
    WHERE t.project_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.projects p WHERE p.id::text = t.project_id
      );

    -- Cast column type to uuid
    ALTER TABLE public.tasks 
      ALTER COLUMN project_id TYPE uuid USING (project_id::uuid);
  END IF;

  -- 1B. Add Foreign Key constraint fk_tasks_project
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_tasks_project'
  ) THEN
    ALTER TABLE public.tasks 
      ADD CONSTRAINT fk_tasks_project 
      FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 1C. Create index for fast project task lookups
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);


-- -------------------------------------------------------------------------
-- STEP 2: project_members.project_id Conversion & Foreign Key Enforcement
-- -------------------------------------------------------------------------

DO $$
DECLARE
  v_pm_pk text;
BEGIN
  -- 2A. If project_members.project_id is currently text, sanitize and cast to uuid
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'project_members' 
      AND column_name = 'project_id' 
      AND data_type = 'text'
  ) THEN
    -- Delete any rows with invalid non-UUID project IDs or non-existent projects
    DELETE FROM public.project_members 
    WHERE project_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR NOT EXISTS (
         SELECT 1 FROM public.projects p WHERE p.id::text = project_members.project_id
       );

    -- Temporarily drop primary key to allow column type alteration
    SELECT constraint_name INTO v_pm_pk
    FROM information_schema.table_constraints
    WHERE table_schema = 'public' 
      AND table_name = 'project_members' 
      AND constraint_type = 'PRIMARY KEY';

    IF v_pm_pk IS NOT NULL THEN
      EXECUTE 'ALTER TABLE public.project_members DROP CONSTRAINT ' || quote_ident(v_pm_pk);
    END IF;

    -- Alter column type to uuid
    ALTER TABLE public.project_members 
      ALTER COLUMN project_id TYPE uuid USING (project_id::uuid);

    -- Re-add compound primary key (project_id, user_id)
    ALTER TABLE public.project_members 
      ADD CONSTRAINT project_members_pkey PRIMARY KEY (project_id, user_id);
  END IF;

  -- 2B. Add Foreign Key constraint fk_project_members_project
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_project_members_project'
  ) THEN
    ALTER TABLE public.project_members 
      ADD CONSTRAINT fk_project_members_project 
      FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2C. Create index for fast user / project membership lookups
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON public.project_members(user_id);

-- 2D. Ensure RLS policies exist on project_members
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'project_members' AND policyname = 'Project members viewable by authenticated users'
  ) THEN
    CREATE POLICY "Project members viewable by authenticated users"
      ON public.project_members FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'project_members' AND policyname = 'Project members insertable by leads and admins'
  ) THEN
    CREATE POLICY "Project members insertable by leads and admins"
      ON public.project_members FOR INSERT
      WITH CHECK (
        auth.role() = 'authenticated'
        AND public.current_user_role() IN ('lead', 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'project_members' AND policyname = 'Project members deletable by leads and admins'
  ) THEN
    CREATE POLICY "Project members deletable by leads and admins"
      ON public.project_members FOR DELETE
      USING (
        auth.role() = 'authenticated'
        AND public.current_user_role() IN ('lead', 'admin')
      );
  END IF;
END $$;


-- -------------------------------------------------------------------------
-- STEP 3: Ensure #general is_protected is TRUE
-- -------------------------------------------------------------------------

UPDATE public.channels 
SET is_protected = true 
WHERE (lower(slug) = 'general' OR lower(name) = 'general')
  AND is_protected = false;

COMMIT;
