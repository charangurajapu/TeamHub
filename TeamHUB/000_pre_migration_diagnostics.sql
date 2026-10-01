-- =========================================================================
-- TEAMHUB PRE-MIGRATION DATA HEALTH & INTEGRITY AUDIT SCRIPT
-- Execute this read-only diagnostic in the Supabase SQL Editor.
-- It bypasses RLS (runs under postgres/dashboard role) and modifies nothing.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Exact Row Counts Per Table
-- -------------------------------------------------------------------------
select 'workspaces' as table_name, count(*) as total_rows from public.workspaces
union all
select 'profiles', count(*) from public.profiles
union all
select 'projects', count(*) from public.projects
union all
select 'project_members', count(*) from public.project_members
union all
select 'tasks', count(*) from public.tasks
union all
select 'channels', count(*) from public.channels
union all
select 'channel_messages', count(*) from public.channel_messages
union all
select 'questions', count(*) from public.questions
union all
select 'question_answers', count(*) from public.question_answers
union all
select 'workspace_files', count(*) from public.workspace_files
union all
select 'reviews', count(*) from public.reviews
union all
select 'join_requests', count(*) from public.join_requests;

-- -------------------------------------------------------------------------
-- 2. Non-UUID Values in tasks.project_id
-- (Finds values that cannot cast cleanly to uuid, e.g., 'proj-1', nulls excluded)
-- -------------------------------------------------------------------------
select 
  id as task_id, 
  workspace_id, 
  key as task_key, 
  title as task_title, 
  project_id as raw_project_id
from public.tasks
where project_id is not null 
  and trim(project_id) <> ''
  and project_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- -------------------------------------------------------------------------
-- 3. Non-UUID Values in project_members.project_id
-- -------------------------------------------------------------------------
select 
  project_id as raw_project_id, 
  user_id, 
  role as member_role
from public.project_members
where project_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- -------------------------------------------------------------------------
-- 4. Orphaned channel_messages.channel_id (No Matching Channel Record)
-- -------------------------------------------------------------------------
select 
  m.id as message_id,
  m.workspace_id as message_workspace_id,
  m.channel_id as unreferenced_channel_id,
  m.author_id,
  left(m.content, 60) as content_preview,
  m.created_at
from public.channel_messages m
left join public.channels c on c.id = m.channel_id
where c.id is null;

-- -------------------------------------------------------------------------
-- 5. Distinct workspace_files.linked_task Values and Task Match Status
-- -------------------------------------------------------------------------
select 
  f.id as file_id,
  f.name as file_name,
  f.linked_task as raw_linked_task,
  t.id as matched_task_id,
  t.key as matched_task_key
from public.workspace_files f
left join public.tasks t on (
  (t.key is not null and lower(t.key) = lower(f.linked_task))
  or (f.linked_task ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and t.id = f.linked_task::uuid)
)
where f.linked_task is not null and trim(f.linked_task) <> '';

-- -------------------------------------------------------------------------
-- 6. Duplicate or Conflicting channels.id Values Across Workspaces
-- (Inspects whether channel ids/slugs collide across different workspaces)
-- -------------------------------------------------------------------------
select 
  id as channel_id, 
  lower(name) as channel_name,
  count(distinct workspace_id) as workspace_count,
  array_agg(distinct workspace_id) as workspace_ids
from public.channels
group by id, lower(name)
having count(distinct workspace_id) > 1 or count(*) > 1;

-- -------------------------------------------------------------------------
-- 7. Cross-Workspace Mismatch Audit (Integrity Sanity Check)
-- Checks if any child record has a workspace_id different from its parent
-- -------------------------------------------------------------------------
-- 7A. Tasks referencing projects in a different workspace
select 
  t.id as task_id,
  t.workspace_id as task_workspace_id,
  p.id as project_id,
  p.workspace_id as project_workspace_id
from public.tasks t
join public.projects p on p.id::text = t.project_id
where t.workspace_id is distinct from p.workspace_id;

-- 7B. Messages referencing channels in a different workspace
select 
  m.id as message_id,
  m.workspace_id as message_workspace_id,
  c.id as channel_id,
  c.workspace_id as channel_workspace_id
from public.channel_messages m
join public.channels c on c.id = m.channel_id
where m.workspace_id is distinct from c.workspace_id;
