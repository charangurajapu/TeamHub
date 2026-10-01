-- =========================================================================
-- 000_schema_drift_report.sql
-- Comprehensive Read-Only Schema Comparison Script for TeamHub.
-- Compares live PostgreSQL instance against supabase_schema.sql.
-- Checks:
--   1. Missing tables
--   2. Missing columns
--   3. Column metadata mismatches (data type, nullability, default expressions)
--   4. Tables with RLS disabled
--   5. Tables with no RLS policies defined
--   6. Policy definition differences (qual and with_check)
--   7. Missing indexes
--   8. Missing functions & triggers
-- =========================================================================

WITH expected_tables(table_name) AS (
  VALUES
    ('workspaces'),
    ('profiles'),
    ('projects'),
    ('project_members'),
    ('tasks'),
    ('channels'),
    ('channel_messages'),
    ('questions'),
    ('question_answers'),
    ('workspace_files'),
    ('join_requests'),
    ('reviews')
),

expected_columns(table_name, column_name, expected_type, expected_nullable, expected_default) AS (
  VALUES
    -- workspaces
    ('workspaces', 'id', 'uuid', 'NO', 'gen_random_uuid()'),
    ('workspaces', 'name', 'text', 'NO', NULL),
    ('workspaces', 'slug', 'text', 'NO', NULL),
    ('workspaces', 'description', 'text', 'YES', '''''::text'),
    ('workspaces', 'team_function', 'text', 'YES', '''engineering''::text'),
    ('workspaces', 'admin_id', 'uuid', 'YES', NULL),
    ('workspaces', 'admin_email', 'text', 'NO', NULL),
    ('workspaces', 'pod_code', 'text', 'NO', NULL),
    ('workspaces', 'is_active', 'boolean', 'YES', 'true'),
    ('workspaces', 'created_at', 'timestamp with time zone', 'NO', 'timezone(''utc''::text, now())'),
    ('workspaces', 'updated_at', 'timestamp with time zone', 'NO', 'timezone(''utc''::text, now())'),

    -- profiles
    ('profiles', 'id', 'uuid', 'NO', NULL),
    ('profiles', 'email', 'text', 'NO', NULL),
    ('profiles', 'full_name', 'text', 'NO', NULL),
    ('profiles', 'role', 'text', 'NO', '''member''::text'),
    ('profiles', 'role_title', 'text', 'YES', '''Team Member''::text'),
    ('profiles', 'department', 'text', 'YES', '''Engineering''::text'),
    ('profiles', 'pod', 'text', 'YES', '''Core Engineering Pod''::text'),
    ('profiles', 'workspace_id', 'uuid', 'YES', NULL),
    ('profiles', 'pod_code', 'text', 'YES', NULL),
    ('profiles', 'avatar_url', 'text', 'YES', NULL),
    ('profiles', 'location', 'text', 'YES', '''San Francisco, CA''::text'),
    ('profiles', 'timezone', 'text', 'YES', '''UTC-7 (PDT)''::text'),
    ('profiles', 'phone', 'text', 'YES', NULL),
    ('profiles', 'date_of_birth', 'text', 'YES', NULL),
    ('profiles', 'date_joined', 'timestamp with time zone', 'NO', 'timezone(''utc''::text, now())'),
    ('profiles', 'reporting_lead', 'text', 'YES', '''David Kim''::text'),
    ('profiles', 'bio', 'character varying', 'YES', NULL),
    ('profiles', 'skills', 'ARRAY', 'YES', '''{Engineering}''::text[]'),
    ('profiles', 'social_links', 'jsonb', 'YES', '''{"github": "", "linkedin": "", "portfolio": ""}''::jsonb'),
    ('profiles', 'notification_preferences', 'jsonb', 'YES', '''{"qnaReplies": false, "directMentions": true, "taskStatusChanges": true}''::jsonb'),
    ('profiles', 'theme', 'text', 'YES', '''light''::text'),
    ('profiles', 'tasks_completed', 'integer', 'YES', '0'),
    ('profiles', 'questions_answered', 'integer', 'YES', '0'),
    ('profiles', 'updated_at', 'timestamp with time zone', 'NO', 'timezone(''utc''::text, now())'),

    -- projects
    ('projects', 'id', 'uuid', 'NO', 'gen_random_uuid()'),
    ('projects', 'workspace_id', 'uuid', 'YES', NULL),
    ('projects', 'name', 'text', 'NO', NULL),
    ('projects', 'description', 'text', 'YES', '''''::text'),
    ('projects', 'target_date', 'text', 'NO', NULL),
    ('projects', 'pod_id', 'text', 'NO', '''core''::text'),
    ('projects', 'pod', 'text', 'NO', '''Core Engineering''::text'),
    ('projects', 'status', 'text', 'NO', '''on_track''::text'),
    ('projects', 'channel_id', 'text', 'YES', NULL),
    ('projects', 'created_by', 'uuid', 'YES', NULL),
    ('projects', 'created_at', 'timestamp with time zone', 'NO', 'timezone(''utc''::text, now())'),
    ('projects', 'updated_at', 'timestamp with time zone', 'NO', 'timezone(''utc''::text, now())'),

    -- project_members
    ('project_members', 'project_id', 'text', 'NO', NULL),
    ('project_members', 'user_id', 'uuid', 'NO', NULL),
    ('project_members', 'role', 'text', 'YES', '''contributor''::text'),
    ('project_members', 'created_at', 'timestamp with time zone', 'NO', 'timezone(''utc''::text, now())'),

    -- tasks
    ('tasks', 'id', 'uuid', 'NO', 'gen_random_uuid()'),
    ('tasks', 'workspace_id', 'uuid', 'YES', NULL),
    ('tasks', 'project_id', 'text', 'YES', NULL),
    ('tasks', 'key', 'text', 'NO', NULL),
    ('tasks', 'title', 'text', 'NO', NULL),
    ('tasks', 'description', 'text', 'YES', '''''::text'),
    ('tasks', 'status', 'text', 'NO', '''todo''::text'),
    ('tasks', 'priority', 'text', 'NO', '''medium''::text'),
    ('tasks', 'channel', 'text', 'YES', '''#backend''::text'),
    ('tasks', 'sprint', 'text', 'YES', '''Sprint 42''::text'),
    ('tasks', 'assignee_id', 'uuid', 'YES', NULL),
    ('tasks', 'reviewer_id', 'uuid', 'YES', NULL),
    ('tasks', 'due_date', 'text', 'YES', NULL),
    ('tasks', 'due_time', 'text', 'YES', NULL),
    ('tasks', 'subtasks', 'jsonb', 'YES', '''[]''::jsonb'),
    ('tasks', 'attachments', 'jsonb', 'YES', '''[]''::jsonb'),
    ('tasks', 'comments', 'jsonb', 'YES', '''[]''::jsonb'),
    ('tasks', 'created_by', 'uuid', 'YES', NULL),
    ('tasks', 'created_at', 'timestamp with time zone', 'NO', 'timezone(''utc''::text, now())'),
    ('tasks', 'updated_at', 'timestamp with time zone', 'NO', 'timezone(''utc''::text, now())'),

    -- channels
    ('channels', 'id', 'text', 'NO', NULL),
    ('channels', 'workspace_id', 'uuid', 'YES', NULL),
    ('channels', 'name', 'text', 'NO', NULL),
    ('channels', 'description', 'text', 'YES', '''''::text'),
    ('channels', 'is_mandatory', 'boolean', 'YES', 'false'),
    ('channels', 'is_protected', 'boolean', 'YES', 'false'),
    ('channels', 'deleted_at', 'timestamp with time zone', 'YES', NULL),
    ('channels', 'deleted_by', 'uuid', 'YES', NULL),
    ('channels', 'created_at', 'timestamp with time zone', 'NO', 'timezone(''utc''::text, now())'),

    -- channel_messages
    ('channel_messages', 'id', 'uuid', 'NO', 'gen_random_uuid()'),
    ('channel_messages', 'workspace_id', 'uuid', 'YES', NULL),
    ('channel_messages', 'channel_id', 'text', 'NO', NULL),
    ('channel_messages', 'author_id', 'uuid', 'NO', NULL),
    ('channel_messages', 'content', 'text', 'NO', NULL),
    ('channel_messages', 'reactions', 'jsonb', 'YES', '''[]''::jsonb'),
    ('channel_messages', 'thread_replies_count', 'integer', 'YES', '0'),
    ('channel_messages', 'created_at', 'timestamp with time zone', 'NO', 'timezone(''utc''::text, now())'),

    -- questions
    ('questions', 'id', 'uuid', 'NO', 'gen_random_uuid()'),
    ('questions', 'workspace_id', 'uuid', 'YES', NULL),
    ('questions', 'key', 'text', 'NO', NULL),
    ('questions', 'title', 'text', 'NO', NULL),
    ('questions', 'content', 'text', 'NO', NULL),
    ('questions', 'author_id', 'uuid', 'NO', NULL),
    ('questions', 'tags', 'ARRAY', 'YES', '''{}''::text[]'),
    ('questions', 'channel', 'text', 'YES', '''#backend''::text'),
    ('questions', 'status', 'text', 'YES', '''open''::text'),
    ('questions', 'views', 'integer', 'YES', '1'),
    ('questions', 'upvotes', 'integer', 'YES', '1'),
    ('questions', 'code_snippet', 'jsonb', 'YES', NULL),
    ('questions', 'ai_summary', 'text', 'YES', NULL),
    ('questions', 'created_at', 'timestamp with time zone', 'NO', 'timezone(''utc''::text, now())'),

    -- question_answers
    ('question_answers', 'id', 'uuid', 'NO', 'gen_random_uuid()'),
    ('question_answers', 'workspace_id', 'uuid', 'YES', NULL),
    ('question_answers', 'question_id', 'uuid', 'NO', NULL),
    ('question_answers', 'author_id', 'uuid', 'NO', NULL),
    ('question_answers', 'content', 'text', 'NO', NULL),
    ('question_answers', 'upvotes', 'integer', 'YES', '1'),
    ('question_answers', 'is_accepted', 'boolean', 'YES', 'false'),
    ('question_answers', 'is_ai_suggested', 'boolean', 'YES', 'false'),
    ('question_answers', 'code_block', 'jsonb', 'YES', NULL),
    ('question_answers', 'tip_box', 'jsonb', 'YES', NULL),
    ('question_answers', 'created_at', 'timestamp with time zone', 'NO', 'timezone(''utc''::text, now())'),

    -- workspace_files
    ('workspace_files', 'id', 'uuid', 'NO', 'gen_random_uuid()'),
    ('workspace_files', 'workspace_id', 'uuid', 'YES', NULL),
    ('workspace_files', 'name', 'text', 'NO', NULL),
    ('workspace_files', 'type', 'text', 'NO', NULL),
    ('workspace_files', 'size', 'text', 'NO', NULL),
    ('workspace_files', 'folder', 'text', 'YES', '''Sprint Deliverables''::text'),
    ('workspace_files', 'uploader_id', 'uuid', 'NO', NULL),
    ('workspace_files', 'preview_url', 'text', 'YES', NULL),
    ('workspace_files', 'url', 'text', 'YES', NULL),
    ('workspace_files', 'tags', 'ARRAY', 'YES', '''{}''::text[]'),
    ('workspace_files', 'ai_summary', 'text', 'YES', NULL),
    ('workspace_files', 'linked_task', 'text', 'YES', NULL),
    ('workspace_files', 'dimensions', 'text', 'YES', NULL),
    ('workspace_files', 'created_at', 'timestamp with time zone', 'NO', 'timezone(''utc''::text, now())'),

    -- join_requests
    ('join_requests', 'id', 'uuid', 'NO', 'gen_random_uuid()'),
    ('join_requests', 'workspace_id', 'uuid', 'YES', NULL),
    ('join_requests', 'name', 'text', 'NO', NULL),
    ('join_requests', 'email', 'text', 'NO', NULL),
    ('join_requests', 'role', 'text', 'NO', NULL),
    ('join_requests', 'department', 'text', 'YES', '''Engineering''::text'),
    ('join_requests', 'avatar_initials', 'text', 'YES', '''TU''::text'),
    ('join_requests', 'requested_at', 'timestamp with time zone', 'NO', 'timezone(''utc''::text, now())'),

    -- reviews
    ('reviews', 'id', 'uuid', 'NO', 'gen_random_uuid()'),
    ('reviews', 'workspace_id', 'uuid', 'YES', NULL),
    ('reviews', 'task_id', 'uuid', 'NO', NULL),
    ('reviews', 'reviewer_id', 'uuid', 'YES', NULL),
    ('reviews', 'assignee_id', 'uuid', 'NO', NULL),
    ('reviews', 'status', 'text', 'NO', '''pending''::text'),
    ('reviews', 'feedback', 'text', 'YES', '''''::text'),
    ('reviews', 'branch', 'text', 'YES', '''''::text'),
    ('reviews', 'pr_number', 'text', 'YES', '''''::text'),
    ('reviews', 'lines_added', 'integer', 'YES', '0'),
    ('reviews', 'lines_removed', 'integer', 'YES', '0'),
    ('reviews', 'files_changed', 'integer', 'YES', '0'),
    ('reviews', 'safe_to_merge', 'boolean', 'YES', 'false'),
    ('reviews', 'metadata', 'jsonb', 'YES', '''{}''::jsonb'),
    ('reviews', 'created_at', 'timestamp with time zone', 'NO', 'timezone(''utc''::text, now())'),
    ('reviews', 'reviewed_at', 'timestamp with time zone', 'YES', NULL)
),

expected_indexes(table_name, index_name) AS (
  VALUES
    ('channel_messages', 'idx_channel_messages_channel_id'),
    ('channel_messages', 'idx_channel_messages_created_at')
),

expected_policies(table_name, policy_name, expected_cmd) AS (
  VALUES
    ('workspaces', 'Workspaces viewable for invite code validation', 'SELECT'),
    ('workspaces', 'Admins can update their workspace', 'UPDATE'),
    ('workspaces', 'Users can register workspaces', 'INSERT'),
    ('profiles', 'Authenticated users can view workspace member profiles', 'SELECT'),
    ('profiles', 'Users can update their own profile or admins can update any profile', 'UPDATE'),
    ('projects', 'Projects viewable by pod members and admins', 'SELECT'),
    ('projects', 'Projects insertable by leads and admins', 'INSERT'),
    ('projects', 'Projects updatable by leads and admins', 'UPDATE'),
    ('projects', 'Projects deletable only by admins', 'DELETE'),
    ('project_members', 'Project members viewable by authenticated users', 'SELECT'),
    ('project_members', 'Project members insertable by leads and admins', 'INSERT'),
    ('project_members', 'Project members deletable by leads and admins', 'DELETE'),
    ('tasks', 'Tasks viewable by authenticated workspace members', 'SELECT'),
    ('tasks', 'Tasks insertable by authenticated workspace members', 'INSERT'),
    ('tasks', 'Tasks updateable by assignee, creator, team leads, or admins', 'UPDATE'),
    ('tasks', 'Tasks deleteable only by team leads or admins', 'DELETE'),
    ('channels', 'Channels viewable by authenticated workspace members', 'SELECT'),
    ('channels', 'Channels insertable by admins or leads', 'INSERT'),
    ('channels', 'Channels updatable by admins or leads', 'UPDATE'),
    ('channels', 'Channels deletable by admins or leads', 'DELETE'),
    ('channel_messages', 'Messages viewable by authenticated workspace members', 'SELECT'),
    ('channel_messages', 'Messages insertable by active author', 'INSERT'),
    ('channel_messages', 'Messages updateable by author or admin', 'UPDATE'),
    ('questions', 'Questions viewable by authenticated workspace members', 'SELECT'),
    ('questions', 'Questions insertable by author', 'INSERT'),
    ('questions', 'Questions updateable by author, lead, or admin', 'UPDATE'),
    ('question_answers', 'Answers viewable by authenticated workspace members', 'SELECT'),
    ('question_answers', 'Answers insertable by author', 'INSERT'),
    ('question_answers', 'Answers updateable by author, question owner, or admin', 'UPDATE'),
    ('workspace_files', 'Files metadata viewable by authenticated workspace members', 'SELECT'),
    ('workspace_files', 'Files metadata insertable by uploader', 'INSERT'),
    ('join_requests', 'Admin only SELECT on join_requests', 'SELECT'),
    ('join_requests', 'Admin only INSERT on join_requests', 'INSERT'),
    ('join_requests', 'Admin only UPDATE on join_requests', 'UPDATE'),
    ('join_requests', 'Admin only DELETE on join_requests', 'DELETE'),
    ('reviews', 'Reviews viewable by assigned lead, admin, and task assignee', 'SELECT'),
    ('reviews', 'Reviews insertable by assignee, leads, and admins', 'INSERT'),
    ('reviews', 'Reviews updatable by assigned lead or admin', 'UPDATE'),
    ('reviews', 'Reviews deletable only by admins', 'DELETE')
),

expected_functions(function_name) AS (
  VALUES
    ('current_user_role'),
    ('current_user_workspace_id'),
    ('current_user_pod'),
    ('check_profile_role_update'),
    ('handle_new_user_profile'),
    ('is_valid_task_assignment'),
    ('get_team_directory')
),

expected_triggers(table_name, trigger_name) AS (
  VALUES
    ('profiles', 'enforce_profile_role_security')
)

-- 1. Missing Tables
SELECT 
  'TABLE' AS item_type,
  et.table_name AS item_name,
  'public' AS parent_object,
  'Table defined in supabase_schema.sql does not exist in public schema' AS drift_description
FROM expected_tables et
LEFT JOIN information_schema.tables t 
  ON t.table_schema = 'public' AND t.table_name = et.table_name
WHERE t.table_name IS NULL

UNION ALL

-- 2. Missing Columns
SELECT 
  'COLUMN' AS item_type,
  ec.column_name AS item_name,
  ec.table_name AS parent_object,
  'Column defined in supabase_schema.sql is missing from table public.' || ec.table_name AS drift_description
FROM expected_columns ec
JOIN information_schema.tables t 
  ON t.table_schema = 'public' AND t.table_name = ec.table_name
LEFT JOIN information_schema.columns c 
  ON c.table_schema = 'public' AND c.table_name = ec.table_name AND c.column_name = ec.column_name
WHERE c.column_name IS NULL

UNION ALL

-- 3. Column Data Type, Nullability & Default Mismatches
SELECT
  'COLUMN_MISMATCH' AS item_type,
  c.column_name AS item_name,
  ec.table_name AS parent_object,
  CASE 
    WHEN c.data_type <> ec.expected_type THEN 
      'Type mismatch: live=' || c.data_type || ', expected=' || ec.expected_type
    WHEN c.is_nullable <> ec.expected_nullable THEN 
      'Nullability mismatch: live is_nullable=' || c.is_nullable || ', expected=' || ec.expected_nullable
    WHEN ec.expected_default IS NOT NULL AND (c.column_default IS NULL OR c.column_default NOT LIKE '%' || ec.expected_default || '%') THEN
      'Default mismatch: live default=' || coalesce(c.column_default, 'NULL') || ', expected=' || ec.expected_default
    ELSE 'Metadata mismatch'
  END AS drift_description
FROM expected_columns ec
JOIN information_schema.columns c
  ON c.table_schema = 'public' AND c.table_name = ec.table_name AND c.column_name = ec.column_name
WHERE (c.data_type <> ec.expected_type)
   OR (c.is_nullable <> ec.expected_nullable)
   OR (ec.expected_default IS NOT NULL AND (c.column_default IS NULL OR c.column_default NOT LIKE '%' || ec.expected_default || '%'))

UNION ALL

-- 4. Tables with Row Level Security (RLS) Disabled
SELECT 
  'RLS_DISABLED' AS item_type,
  c.relname AS item_name,
  'public.' || c.relname AS parent_object,
  'Row Level Security is DISABLED on table public.' || c.relname AS drift_description
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN expected_tables et ON et.table_name = c.relname
WHERE n.nspname = 'public' 
  AND c.relkind = 'r' 
  AND c.relrowsecurity = false

UNION ALL

-- 5. Tables with Zero RLS Policies Defined
SELECT 
  'NO_POLICIES' AS item_type,
  t.table_name AS item_name,
  'public.' || t.table_name AS parent_object,
  'Table exists and has RLS enabled, but has ZERO policies defined in pg_policies' AS drift_description
FROM expected_tables t
JOIN pg_class c ON c.relname = t.table_name
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = t.table_name
WHERE c.relkind = 'r'
GROUP BY t.table_name
HAVING count(p.policyname) = 0

UNION ALL

-- 6. Missing Policies
SELECT 
  'POLICY_MISSING' AS item_type,
  ep.policy_name AS item_name,
  ep.table_name AS parent_object,
  'Policy defined in supabase_schema.sql is missing from table public.' || ep.table_name AS drift_description
FROM expected_policies ep
LEFT JOIN pg_policies pp 
  ON pp.schemaname = 'public' AND pp.tablename = ep.table_name AND pp.policyname = ep.policy_name
WHERE pp.policyname IS NULL

UNION ALL

-- 7. Policy Definition Command / Scope Mismatch
SELECT 
  'POLICY_DIFF' AS item_type,
  pp.policyname AS item_name,
  pp.tablename AS parent_object,
  'Policy command mismatch: live cmd=' || pp.cmd || ', expected=' || ep.expected_cmd AS drift_description
FROM expected_policies ep
JOIN pg_policies pp 
  ON pp.schemaname = 'public' AND pp.tablename = ep.table_name AND pp.policyname = ep.policy_name
WHERE pp.cmd <> ep.expected_cmd

UNION ALL

-- 8. Missing Indexes
SELECT 
  'INDEX' AS item_type,
  ei.index_name AS item_name,
  ei.table_name AS parent_object,
  'Index defined in supabase_schema.sql is missing from table public.' || ei.table_name AS drift_description
FROM expected_indexes ei
LEFT JOIN pg_indexes pi 
  ON pi.schemaname = 'public' AND pi.tablename = ei.table_name AND pi.indexname = ei.index_name
WHERE pi.indexname IS NULL

UNION ALL

-- 9. Missing Functions
SELECT 
  'FUNCTION' AS item_type,
  ef.function_name AS item_name,
  'public' AS parent_object,
  'Function defined in supabase_schema.sql is missing from public schema' AS drift_description
FROM expected_functions ef
LEFT JOIN pg_proc p 
  ON p.pronamespace = 'public'::regnamespace AND p.proname = ef.function_name
WHERE p.proname IS NULL

UNION ALL

-- 10. Missing Triggers
SELECT 
  'TRIGGER' AS item_type,
  etr.trigger_name AS item_name,
  etr.table_name AS parent_object,
  'Trigger defined in supabase_schema.sql is missing from table public.' || etr.table_name AS drift_description
FROM expected_triggers etr
LEFT JOIN information_schema.triggers tr 
  ON tr.trigger_schema = 'public' AND tr.event_object_table = etr.table_name AND tr.trigger_name = etr.trigger_name
WHERE tr.trigger_name IS NULL

ORDER BY item_type, parent_object, item_name;
