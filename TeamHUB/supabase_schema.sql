-- =========================================================================
-- TeamHub Comprehensive Database Schema & Row Level Security (RLS)
-- Multi-Tenant Workspace & Pod Code Isolation
-- Roles: Member ('member'), Team Lead ('lead'), Administrator ('admin')
-- =========================================================================

-- =========================================================================
-- Clean Tear-down (Drop all 12 tables with CASCADE for fresh idempotency)
-- =========================================================================
drop table if exists public.project_members cascade;
drop table if exists public.projects cascade;
drop table if exists public.reviews cascade;
drop table if exists public.join_requests cascade;
drop table if exists public.workspace_files cascade;
drop table if exists public.question_answers cascade;
drop table if exists public.questions cascade;
drop table if exists public.channel_messages cascade;
drop table if exists public.channels cascade;
drop table if exists public.tasks cascade;
drop table if exists public.profiles cascade;
drop table if exists public.workspaces cascade;


-- =========================================================================
-- 1. Core Base Tables: Workspaces & Profiles (Created Back-to-Back, No Policies)
-- =========================================================================

-- 1A. Workspaces Table
create table if not exists public.workspaces (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text not null unique,
  description text default '',
  team_function text default 'engineering',
  admin_id uuid references auth.users(id) on delete set null,
  admin_email text not null,
  pod_code text not null unique,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 1B. Profiles Table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text not null,
  role text not null default 'member' check (role in ('member', 'lead', 'admin')),
  role_title text default 'Team Member',
  department text default 'Engineering',
  pod text default 'Core Engineering Pod',
  workspace_id uuid references public.workspaces(id) on delete set null,
  pod_code text,
  avatar_url text,
  location text default 'San Francisco, CA',
  timezone text default 'UTC-7 (PDT)',
  phone text,
  date_of_birth text,
  date_joined timestamp with time zone default timezone('utc'::text, now()) not null,
  reporting_lead text default 'David Kim',
  bio varchar(200),
  skills text[] default '{"Engineering"}',
  social_links jsonb default '{"github": "", "linkedin": "", "portfolio": ""}'::jsonb,
  notification_preferences jsonb default '{"directMentions": true, "taskStatusChanges": true, "qnaReplies": false}'::jsonb,
  theme text default 'light' check (theme in ('light', 'dark', 'system')),
  tasks_completed int default 0,
  questions_answered int default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on core tables
alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;


-- =========================================================================
-- 2. Non-Recursive RLS Helper Functions (SECURITY DEFINER)
-- Bypasses RLS recursion on public.profiles when evaluating caller credentials
-- =========================================================================
create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_workspace_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select workspace_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_pod()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(pod, pod_code) from public.profiles where id = auth.uid();
$$;


-- =========================================================================
-- 3. Workspaces & Profiles Policies & Triggers
-- =========================================================================

-- Workspaces Policies
create policy "Workspaces viewable for invite code validation"
  on public.workspaces for select
  using (true);

create policy "Admins can update their workspace"
  on public.workspaces for update
  using (
    auth.uid() = admin_id
    or public.current_user_role() = 'admin'
  );

create policy "Users can register workspaces"
  on public.workspaces for insert
  with check (true);

-- Profiles Policies: Clean, non-recursive
create policy "Authenticated users can view workspace member profiles"
  on public.profiles for select
  using (
    auth.role() = 'authenticated'
    and (
      auth.uid() = id
      or workspace_id is null 
      or workspace_id = public.current_user_workspace_id()
      or public.current_user_role() = 'admin'
    )
  );

create policy "Users can update their own profile or admins can update any profile"
  on public.profiles for update
  using (
    auth.uid() = id
    or public.current_user_role() = 'admin'
  )
  with check (
    auth.uid() = id
    or public.current_user_role() = 'admin'
  );

-- Trigger: Server-side enforcement preventing non-admins from altering their own 'role' column
create or replace function public.check_profile_role_update()
returns trigger as $$
begin
  if new.role <> old.role and public.current_user_role() <> 'admin' then
    raise exception 'Security Policy Violation: Only an Administrator is permitted to modify user roles.';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists enforce_profile_role_security on public.profiles;
create trigger enforce_profile_role_security
  before update on public.profiles
  for each row execute function public.check_profile_role_update();

-- Auto-create profile trigger on auth.user creation
create or replace function public.handle_new_user_profile()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role, role_title, workspace_id, pod_code)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'member'),
    case 
      when coalesce(new.raw_user_meta_data->>'role', 'member') = 'admin' then 'Workspace Administrator'
      when coalesce(new.raw_user_meta_data->>'role', 'member') = 'lead' then 'Team Lead'
      else 'Team Member'
    end,
    (new.raw_user_meta_data->>'workspace_id')::uuid,
    new.raw_user_meta_data->>'pod_code'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = case when profiles.full_name = '' then excluded.full_name else profiles.full_name end,
    workspace_id = coalesce(profiles.workspace_id, excluded.workspace_id),
    pod_code = coalesce(profiles.pod_code, excluded.pod_code);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();


-- =========================================================================
-- 4. Projects & Project Members Table & Row Level Security (RLS)
-- Columns: (id, workspace_id, name, description, target_date, pod_id, pod, status, channel_id, created_by, created_at, updated_at)
-- RLS scoping projects to members of that pod (and admins)
-- =========================================================================
create table if not exists public.projects (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text not null,
  description text default '',
  target_date text not null,
  pod_id text not null default 'core',
  pod text not null default 'Core Engineering',
  status text not null default 'on_track' check (status in ('on_track', 'at_risk', 'completed', 'blocked')),
  channel_id text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.projects enable row level security;

-- 1. SELECT Policy: Scoped to members of that pod (or workspace) and admins
create policy "Projects viewable by pod members and admins"
  on public.projects for select
  using (
    auth.role() = 'authenticated'
    and (
      public.current_user_role() = 'admin'
      or pod_id = (select coalesce(pod_code, 'core') from public.profiles where id = auth.uid())
      or pod = (select pod from public.profiles where id = auth.uid())
      or workspace_id = public.current_user_workspace_id()
      or workspace_id is null
    )
  );

-- 2. INSERT Policy: Team Lead and Administrator can create projects
create policy "Projects insertable by leads and admins"
  on public.projects for insert
  with check (
    auth.role() = 'authenticated'
    and public.current_user_role() in ('lead', 'admin')
  );

-- 3. UPDATE Policy: Leads and Admins can update projects
create policy "Projects updatable by leads and admins"
  on public.projects for update
  using (
    auth.role() = 'authenticated'
    and public.current_user_role() in ('lead', 'admin')
  )
  with check (
    auth.role() = 'authenticated'
    and public.current_user_role() in ('lead', 'admin')
  );

-- 4. DELETE Policy: Admins only
create policy "Projects deletable only by admins"
  on public.projects for delete
  using (
    public.current_user_role() = 'admin'
  );

-- 4B. Project Members Join Table
create table if not exists public.project_members (
  project_id text not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'contributor',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (project_id, user_id)
);

alter table public.project_members enable row level security;

create policy "Project members viewable by authenticated users"
  on public.project_members for select
  using (auth.role() = 'authenticated');

create policy "Project members insertable by leads and admins"
  on public.project_members for insert
  with check (
    auth.role() = 'authenticated'
    and public.current_user_role() in ('lead', 'admin')
  );

create policy "Project members deletable by leads and admins"
  on public.project_members for delete
  using (
    auth.role() = 'authenticated'
    and public.current_user_role() in ('lead', 'admin')
  );

-- 4C. Server-Side Task Assignment Validation Function (SECURITY DEFINER)
-- Enforces:
-- 1. Team Lead: Assignee MUST belong to the same pod as the Lead.
-- 2. Administrator: Assignee MUST belong to the specified project (project_members join table or project's pod).
--    If no project is specified, falls back to allowing any workspace member.
create or replace function public.is_valid_task_assignment(p_assignee_id uuid, p_project_id text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_caller_role text;
  v_caller_pod text;
  v_caller_pod_code text;
  v_assignee_pod text;
  v_assignee_pod_code text;
begin
  -- Unassigned tasks or self-assignment are always permitted
  if p_assignee_id is null or p_assignee_id = auth.uid() then
    return true;
  end if;

  select role, pod, pod_code into v_caller_role, v_caller_pod, v_caller_pod_code
  from public.profiles where id = auth.uid();

  -- Non-leads/non-admins cannot assign tasks to other people
  if v_caller_role is null or v_caller_role not in ('lead', 'admin') then
    return false;
  end if;

  -- 1. Team Lead: Assignee MUST belong to Lead's own pod
  if v_caller_role = 'lead' then
    select pod, pod_code into v_assignee_pod, v_assignee_pod_code
    from public.profiles where id = p_assignee_id;

    if v_assignee_pod is null and v_assignee_pod_code is null then
      return false;
    end if;

    return (
      (v_caller_pod is not null and v_assignee_pod is not null and (
        lower(v_caller_pod) = lower(v_assignee_pod)
        or (lower(v_caller_pod) like '%core%' and lower(v_assignee_pod) like '%core%')
        or (lower(v_caller_pod) like '%mobile%' and lower(v_assignee_pod) like '%mobile%')
        or (lower(v_caller_pod) like '%design%' and lower(v_assignee_pod) like '%design%')
        or (lower(v_caller_pod) like '%infra%' and lower(v_assignee_pod) like '%infra%')
      ))
      or (v_caller_pod_code is not null and v_assignee_pod_code is not null and lower(v_caller_pod_code) = lower(v_assignee_pod_code))
    );
  end if;

  -- 2. Administrator: Scoped by the task's project_id
  if v_caller_role = 'admin' then
    -- If no project is associated, allow all workspace members
    if p_project_id is null or trim(p_project_id) = '' then
      return true;
    end if;

    -- Check explicit membership in project_members join table
    if exists (
      select 1 from public.project_members pm
      where (pm.project_id = p_project_id or pm.project_id::text = p_project_id)
        and pm.user_id = p_assignee_id
    ) then
      return true;
    end if;

    -- Fallback: Check project's pod or creator
    if exists (
      select 1 from public.projects p
      join public.profiles pr on pr.id = p_assignee_id
      where (p.id::text = p_project_id)
        and (
          p.created_by = p_assignee_id
          or (p.pod is not null and pr.pod is not null and (
            lower(p.pod) = lower(pr.pod)
            or (lower(p.pod) like '%core%' and lower(pr.pod) like '%core%')
            or (lower(p.pod) like '%mobile%' and lower(pr.pod) like '%mobile%')
            or (lower(p.pod) like '%infra%' and lower(pr.pod) like '%infra%')
            or (lower(p.pod) like '%design%' and lower(pr.pod) like '%design%')
          ))
          or (p.pod_id is not null and (pr.pod_code = p.pod_id or pr.pod = p.pod_id))
        )
    ) then
      return true;
    end if;

    return false;
  end if;

  return false;
end;
$$;


-- =========================================================================
-- 5. Tasks Table & Row Level Security (Scoped to Workspace & Assignment Scope)
-- =========================================================================
create table if not exists public.tasks (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  project_id text,
  key text not null,
  title text not null,
  description text default '',
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'review', 'done')),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  channel text default '#backend',
  sprint text default 'Sprint 42',
  assignee_id uuid references public.profiles(id) on delete set null,
  reviewer_id uuid references public.profiles(id) on delete set null,
  due_date text,
  due_time text,
  subtasks jsonb default '[]'::jsonb,
  attachments jsonb default '[]'::jsonb,
  comments jsonb default '[]'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Idempotent column addition for existing tasks table
alter table public.tasks add column if not exists project_id text;

alter table public.tasks enable row level security;

create policy "Tasks viewable by authenticated workspace members"
  on public.tasks for select
  using (
    auth.role() = 'authenticated'
    and (
      workspace_id is null 
      or workspace_id = public.current_user_workspace_id()
      or public.current_user_role() = 'admin'
    )
  );

create policy "Tasks insertable by authenticated workspace members"
  on public.tasks for insert
  with check (
    auth.role() = 'authenticated'
    and (
      workspace_id is null 
      or workspace_id = public.current_user_workspace_id()
      or public.current_user_role() = 'admin'
    )
    and (
      assignee_id is null
      or public.is_valid_task_assignment(assignee_id, project_id)
    )
  );

create policy "Tasks updateable by assignee, creator, team leads, or admins"
  on public.tasks for update
  using (
    (
      auth.uid() = assignee_id
      or auth.uid() = created_by
      or public.current_user_role() in ('lead', 'admin')
    )
    and (
      workspace_id is null 
      or workspace_id = public.current_user_workspace_id()
      or public.current_user_role() = 'admin'
    )
  )
  with check (
    (
      auth.uid() = assignee_id
      or auth.uid() = created_by
      or public.current_user_role() in ('lead', 'admin')
    )
    and (
      assignee_id is null
      or public.is_valid_task_assignment(assignee_id, project_id)
    )
  );

create policy "Tasks deleteable only by team leads or admins"
  on public.tasks for delete
  using (
    public.current_user_role() in ('lead', 'admin')
    and (
      workspace_id is null 
      or workspace_id = public.current_user_workspace_id()
      or public.current_user_role() = 'admin'
    )
  );


-- =========================================================================
-- 5. Channels & Messages Table & Row Level Security (Scoped to Workspace)
-- =========================================================================
create table if not exists public.channels (
  id text primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text not null,
  description text default '',
  is_mandatory boolean default false,
  is_protected boolean default false,
  deleted_at timestamp with time zone default null,
  deleted_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Idempotent column additions for existing tables
alter table public.channels add column if not exists is_protected boolean default false;
alter table public.channels add column if not exists deleted_at timestamp with time zone default null;
alter table public.channels add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

alter table public.channels enable row level security;

drop policy if exists "Channels viewable by authenticated workspace members" on public.channels;
create policy "Channels viewable by authenticated workspace members"
  on public.channels for select
  using (
    auth.role() = 'authenticated'
    and (deleted_at is null or public.current_user_role() in ('admin', 'lead'))
    and (
      workspace_id is null 
      or workspace_id = public.current_user_workspace_id()
      or public.current_user_role() = 'admin'
    )
  );

drop policy if exists "Channels insertable by admins or leads" on public.channels;
create policy "Channels insertable by admins or leads"
  on public.channels for insert
  with check (
    public.current_user_role() in ('admin', 'lead')
    and (
      workspace_id is null 
      or workspace_id = public.current_user_workspace_id()
      or public.current_user_role() = 'admin'
    )
  );

drop policy if exists "Channels updatable by admins or leads" on public.channels;
create policy "Channels updatable by admins or leads"
  on public.channels for update
  using (
    public.current_user_role() in ('admin', 'lead')
    and lower(name) != 'general'
    and lower(id) != 'general'
    and coalesce(is_protected, false) = false
    and (
      workspace_id is null 
      or workspace_id = public.current_user_workspace_id()
      or public.current_user_role() = 'admin'
    )
  )
  with check (
    public.current_user_role() in ('admin', 'lead')
    and lower(name) != 'general'
    and lower(id) != 'general'
    and coalesce(is_protected, false) = false
  );

drop policy if exists "Channels deletable by admins or leads" on public.channels;
create policy "Channels deletable by admins or leads"
  on public.channels for delete
  using (
    public.current_user_role() in ('admin', 'lead')
    and lower(name) != 'general'
    and lower(id) != 'general'
    and coalesce(is_protected, false) = false
    and (
      workspace_id is null 
      or workspace_id = public.current_user_workspace_id()
      or public.current_user_role() = 'admin'
    )
  );

create table if not exists public.channel_messages (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  channel_id text not null,
  author_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  reactions jsonb default '[]'::jsonb,
  thread_replies_count int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_channel_messages_channel_id on public.channel_messages(channel_id);
create index if not exists idx_channel_messages_created_at on public.channel_messages(created_at);

alter table public.channel_messages enable row level security;

create policy "Messages viewable by authenticated workspace members"
  on public.channel_messages for select
  using (
    auth.role() = 'authenticated'
    and (
      workspace_id is null 
      or workspace_id = public.current_user_workspace_id()
      or public.current_user_role() = 'admin'
    )
  );

create policy "Messages insertable by active author"
  on public.channel_messages for insert
  with check (
    auth.uid() = author_id
    and (
      workspace_id is null 
      or workspace_id = public.current_user_workspace_id()
      or public.current_user_role() = 'admin'
    )
  );

create policy "Messages updateable by author or admin"
  on public.channel_messages for update
  using (
    auth.uid() = author_id
    or public.current_user_role() = 'admin'
  );


-- =========================================================================
-- 6. Questions & Answers Tables & Row Level Security (Scoped to Workspace)
-- =========================================================================
create table if not exists public.questions (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  key text not null,
  title text not null,
  content text not null,
  author_id uuid references public.profiles(id) on delete cascade not null,
  tags text[] default '{}',
  channel text default '#backend',
  status text default 'open' check (status in ('open', 'answered', 'resolved')),
  views int default 1,
  upvotes int default 1,
  code_snippet jsonb,
  ai_summary text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.questions enable row level security;

create policy "Questions viewable by authenticated workspace members"
  on public.questions for select
  using (
    auth.role() = 'authenticated'
    and (
      workspace_id is null 
      or workspace_id = public.current_user_workspace_id()
      or public.current_user_role() = 'admin'
    )
  );

create policy "Questions insertable by author"
  on public.questions for insert
  with check (
    auth.uid() = author_id
    and (
      workspace_id is null 
      or workspace_id = public.current_user_workspace_id()
      or public.current_user_role() = 'admin'
    )
  );

create policy "Questions updateable by author, lead, or admin"
  on public.questions for update
  using (
    auth.uid() = author_id
    or public.current_user_role() in ('lead', 'admin')
  );

create table if not exists public.question_answers (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  upvotes int default 1,
  is_accepted boolean default false,
  is_ai_suggested boolean default false,
  code_block jsonb,
  tip_box jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.question_answers enable row level security;

create policy "Answers viewable by authenticated workspace members"
  on public.question_answers for select
  using (
    auth.role() = 'authenticated'
    and (
      workspace_id is null 
      or workspace_id = public.current_user_workspace_id()
      or public.current_user_role() = 'admin'
    )
  );

create policy "Answers insertable by author"
  on public.question_answers for insert
  with check (
    auth.uid() = author_id
    and (
      workspace_id is null 
      or workspace_id = public.current_user_workspace_id()
      or public.current_user_role() = 'admin'
    )
  );

create policy "Answers updateable by author, question owner, or admin"
  on public.question_answers for update
  using (
    auth.uid() = author_id
    or auth.uid() = (select author_id from public.questions where id = question_id)
    or public.current_user_role() = 'admin'
  );


-- =========================================================================
-- 7. Files Metadata & Storage Buckets (Scoped to Workspace)
-- =========================================================================
create table if not exists public.workspace_files (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text not null,
  type text not null,
  size text not null,
  folder text default 'Sprint Deliverables',
  uploader_id uuid references public.profiles(id) on delete cascade not null,
  preview_url text,
  url text,
  tags text[] default '{}',
  ai_summary text,
  linked_task text,
  dimensions text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.workspace_files enable row level security;

create policy "Files metadata viewable by authenticated workspace members"
  on public.workspace_files for select
  using (
    auth.role() = 'authenticated'
    and (
      workspace_id is null 
      or workspace_id = public.current_user_workspace_id()
      or public.current_user_role() = 'admin'
    )
  );

create policy "Files metadata insertable by uploader"
  on public.workspace_files for insert
  with check (
    auth.uid() = uploader_id
    and (
      workspace_id is null 
      or workspace_id = public.current_user_workspace_id()
      or public.current_user_role() = 'admin'
    )
  );

-- Storage Buckets: "avatars" and "files"
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true), ('files', 'files', true)
on conflict (id) do nothing;

drop policy if exists "Public avatar & file images are viewable by everyone" on storage.objects;
create policy "Public avatar & file images are viewable by everyone"
  on storage.objects for select
  using (bucket_id in ('avatars', 'files'));

drop policy if exists "Users can upload avatar/file to their own folder" on storage.objects;
create policy "Users can upload avatar/file to their own folder"
  on storage.objects for insert
  with check (
    bucket_id in ('avatars', 'files')
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.current_user_role() = 'admin'
    )
  );


-- =========================================================================
-- 8. ADMIN-ONLY TABLE: Join Requests (Scoped to Workspace)
-- STRICT SERVER-SIDE RLS: Non-admins cannot read or write to this table!
-- =========================================================================
create table if not exists public.join_requests (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null check (role in ('member', 'lead', 'admin')),
  department text default 'Engineering',
  avatar_initials text default 'TU',
  requested_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.join_requests enable row level security;

-- STRICT ADMIN-ONLY RLS POLICIES:
create policy "Admin only SELECT on join_requests"
  on public.join_requests for select
  using (
    public.current_user_role() = 'admin'
  );

create policy "Admin only INSERT on join_requests"
  on public.join_requests for insert
  with check (
    public.current_user_role() = 'admin'
  );

create policy "Admin only UPDATE on join_requests"
  on public.join_requests for update
  using (
    public.current_user_role() = 'admin'
  );

create policy "Admin only DELETE on join_requests"
  on public.join_requests for delete
  using (
    public.current_user_role() = 'admin'
  );


-- =========================================================================
-- 9. Reviews Table & Row Level Security (RLS)
-- Columns: (task_id, reviewer_id, assignee_id, status, feedback, created_at, reviewed_at)
-- RLS scoping access to the assigned Lead, Admin, and the task's assignee
-- =========================================================================
create table if not exists public.reviews (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade not null,
  reviewer_id uuid references public.profiles(id) on delete set null,
  assignee_id uuid references public.profiles(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'changes_requested', 'rejected')),
  feedback text default '',
  branch text default '',
  pr_number text default '',
  lines_added int default 0,
  lines_removed int default 0,
  files_changed int default 0,
  safe_to_merge boolean default false,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  reviewed_at timestamp with time zone
);

alter table public.reviews enable row level security;

-- 1. SELECT Policy: Scoped to assigned Lead, Admin, and the task's assignee
create policy "Reviews viewable by assigned lead, admin, and task assignee"
  on public.reviews for select
  using (
    auth.role() = 'authenticated'
    and (
      auth.uid() = assignee_id
      or auth.uid() = reviewer_id
      or public.current_user_role() in ('lead', 'admin')
    )
  );

-- 2. INSERT Policy: Task assignee, leads, and admins can submit review requests
create policy "Reviews insertable by assignee, leads, and admins"
  on public.reviews for insert
  with check (
    auth.role() = 'authenticated'
    and (
      auth.uid() = assignee_id
      or public.current_user_role() in ('lead', 'admin')
    )
  );

-- 3. UPDATE Policy: Assigned lead or admin can approve/request changes/reject
create policy "Reviews updatable by assigned lead or admin"
  on public.reviews for update
  using (
    auth.role() = 'authenticated'
    and (
      auth.uid() = reviewer_id
      or public.current_user_role() in ('lead', 'admin')
    )
  )
  with check (
    auth.role() = 'authenticated'
    and (
      auth.uid() = reviewer_id
      or public.current_user_role() in ('lead', 'admin')
    )
  );

-- 4. DELETE Policy: Admins only
create policy "Reviews deletable only by admins"
  on public.reviews for delete
  using (
    public.current_user_role() = 'admin'
  );



-- =========================================================================
-- 11. Team Directory RLS & Scoped Security Functions
-- =========================================================================
-- Enforces that Team Leads can only query profiles in their assigned pod,
-- Admins can query all profiles across all pods,
-- and Team Members have no access to the Team Directory tab query.

create or replace function public.get_team_directory()
returns setof public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_role text;
  viewer_pod text;
  viewer_pod_code text;
begin
  select role, pod, pod_code into viewer_role, viewer_pod, viewer_pod_code
  from public.profiles
  where id = auth.uid();

  -- Team Members are prohibited from accessing the Team Directory endpoint
  if viewer_role = 'member' or viewer_role is null then
    raise exception 'Access Denied: Team directory is restricted to Team Leads and Administrators.';
  end if;

  -- Administrators can view all profiles in the workspace
  if viewer_role = 'admin' then
    return query
    select * from public.profiles
    order by full_name asc;
  end if;

  -- Team Leads can only query members belonging to their own pod
  if viewer_role = 'lead' then
    return query
    select * from public.profiles
    where (
      (pod is not null and pod = viewer_pod)
      or (pod_code is not null and pod_code = viewer_pod_code)
      or id = auth.uid()
    )
    order by full_name asc;
  end if;

  return;
end;
$$;
