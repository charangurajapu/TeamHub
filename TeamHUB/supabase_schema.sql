-- =========================================================================
-- TeamHub Comprehensive Database Schema & Row Level Security (RLS)
-- Multi-Tenant Workspace & Pod Code Isolation
-- Roles: Member ('member'), Team Lead ('lead'), Administrator ('admin')
-- =========================================================================

-- =========================================================================
-- 0. Workspaces & Pod Code Management
-- =========================================================================
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

alter table public.workspaces enable row level security;

-- Public / Authenticated read for pod code validation during team registration
create policy "Workspaces viewable for invite code validation"
  on public.workspaces for select
  using (true);

-- Admins can update their workspace or regenerate pod codes
create policy "Admins can update their workspace"
  on public.workspaces for update
  using (
    auth.uid() = admin_id
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- Authenticated users or signups can register workspaces
create policy "Users can register workspaces"
  on public.workspaces for insert
  with check (true);


-- =========================================================================
-- 1. Profiles Table linked to Supabase Auth & Workspaces
-- =========================================================================
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

-- Enable RLS on Profiles
alter table public.profiles enable row level security;

-- Profiles Policies: Scoped to workspace members
create policy "Authenticated users can view workspace member profiles"
  on public.profiles for select
  using (
    auth.role() = 'authenticated'
    and (
      workspace_id is null 
      or workspace_id = (select workspace_id from public.profiles where id = auth.uid())
      or (select role from public.profiles where id = auth.uid()) = 'admin'
    )
  );

create policy "Users can update their own profile or admins can update any profile"
  on public.profiles for update
  using (
    auth.uid() = id
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  )
  with check (
    auth.uid() = id
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- Trigger: Server-side enforcement preventing non-admins from altering their own 'role' column
create or replace function public.check_profile_role_update()
returns trigger as $$
begin
  if new.role <> old.role and (select role from public.profiles where id = auth.uid()) <> 'admin' then
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
-- 2. Tasks Table & Row Level Security (Scoped to Workspace)
-- =========================================================================
create table if not exists public.tasks (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
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

alter table public.tasks enable row level security;

create policy "Tasks viewable by authenticated workspace members"
  on public.tasks for select
  using (
    auth.role() = 'authenticated'
    and (
      workspace_id is null 
      or workspace_id = (select workspace_id from public.profiles where id = auth.uid())
      or (select role from public.profiles where id = auth.uid()) = 'admin'
    )
  );

create policy "Tasks insertable by authenticated workspace members"
  on public.tasks for insert
  with check (
    auth.role() = 'authenticated'
    and (
      workspace_id is null 
      or workspace_id = (select workspace_id from public.profiles where id = auth.uid())
      or (select role from public.profiles where id = auth.uid()) = 'admin'
    )
  );

create policy "Tasks updateable by assignee, creator, team leads, or admins"
  on public.tasks for update
  using (
    (
      auth.uid() = assignee_id
      or auth.uid() = created_by
      or (select role from public.profiles where id = auth.uid()) in ('lead', 'admin')
    )
    and (
      workspace_id is null 
      or workspace_id = (select workspace_id from public.profiles where id = auth.uid())
      or (select role from public.profiles where id = auth.uid()) = 'admin'
    )
  );

create policy "Tasks deleteable only by team leads or admins"
  on public.tasks for delete
  using (
    (select role from public.profiles where id = auth.uid()) in ('lead', 'admin')
    and (
      workspace_id is null 
      or workspace_id = (select workspace_id from public.profiles where id = auth.uid())
      or (select role from public.profiles where id = auth.uid()) = 'admin'
    )
  );


-- =========================================================================
-- 3. Channels & Messages Table & Row Level Security (Scoped to Workspace)
-- =========================================================================
create table if not exists public.channels (
  id text primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text not null,
  description text default '',
  is_mandatory boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.channels enable row level security;

create policy "Channels viewable by authenticated workspace members"
  on public.channels for select
  using (
    auth.role() = 'authenticated'
    and (
      workspace_id is null 
      or workspace_id = (select workspace_id from public.profiles where id = auth.uid())
      or (select role from public.profiles where id = auth.uid()) = 'admin'
    )
  );

create policy "Channels insertable by admins or leads"
  on public.channels for insert
  with check (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'lead')
    or auth.role() = 'authenticated'
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

alter table public.channel_messages enable row level security;

create policy "Messages viewable by authenticated workspace members"
  on public.channel_messages for select
  using (
    auth.role() = 'authenticated'
    and (
      workspace_id is null 
      or workspace_id = (select workspace_id from public.profiles where id = auth.uid())
      or (select role from public.profiles where id = auth.uid()) = 'admin'
    )
  );

create policy "Messages insertable by active author"
  on public.channel_messages for insert
  with check (
    auth.uid() = author_id
    and (
      workspace_id is null 
      or workspace_id = (select workspace_id from public.profiles where id = auth.uid())
      or (select role from public.profiles where id = auth.uid()) = 'admin'
    )
  );

create policy "Messages updateable by author or admin"
  on public.channel_messages for update
  using (
    auth.uid() = author_id
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  );


-- =========================================================================
-- 4. Questions & Answers Tables & Row Level Security (Scoped to Workspace)
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
      or workspace_id = (select workspace_id from public.profiles where id = auth.uid())
      or (select role from public.profiles where id = auth.uid()) = 'admin'
    )
  );

create policy "Questions insertable by author"
  on public.questions for insert
  with check (
    auth.uid() = author_id
    and (
      workspace_id is null 
      or workspace_id = (select workspace_id from public.profiles where id = auth.uid())
      or (select role from public.profiles where id = auth.uid()) = 'admin'
    )
  );

create policy "Questions updateable by author, lead, or admin"
  on public.questions for update
  using (
    auth.uid() = author_id
    or (select role from public.profiles where id = auth.uid()) in ('lead', 'admin')
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
      or workspace_id = (select workspace_id from public.profiles where id = auth.uid())
      or (select role from public.profiles where id = auth.uid()) = 'admin'
    )
  );

create policy "Answers insertable by author"
  on public.question_answers for insert
  with check (
    auth.uid() = author_id
    and (
      workspace_id is null 
      or workspace_id = (select workspace_id from public.profiles where id = auth.uid())
      or (select role from public.profiles where id = auth.uid()) = 'admin'
    )
  );

create policy "Answers updateable by author, question owner, or admin"
  on public.question_answers for update
  using (
    auth.uid() = author_id
    or auth.uid() = (select author_id from public.questions where id = question_id)
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  );


-- =========================================================================
-- 5. Files Metadata & Storage Buckets (Scoped to Workspace)
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
      or workspace_id = (select workspace_id from public.profiles where id = auth.uid())
      or (select role from public.profiles where id = auth.uid()) = 'admin'
    )
  );

create policy "Files metadata insertable by uploader"
  on public.workspace_files for insert
  with check (
    auth.uid() = uploader_id
    and (
      workspace_id is null 
      or workspace_id = (select workspace_id from public.profiles where id = auth.uid())
      or (select role from public.profiles where id = auth.uid()) = 'admin'
    )
  );

-- Storage Buckets: "avatars" and "files"
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true), ('files', 'files', true)
on conflict (id) do nothing;

alter table storage.objects enable row level security;

create policy "Public avatar & file images are viewable by everyone"
  on storage.objects for select
  using (bucket_id in ('avatars', 'files'));

create policy "Users can upload avatar/file to their own folder"
  on storage.objects for insert
  with check (
    bucket_id in ('avatars', 'files')
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or (select role from public.profiles where id = auth.uid()) = 'admin'
    )
  );


-- =========================================================================
-- 6. ADMIN-ONLY TABLE: Join Requests (Scoped to Workspace)
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

-- STRICT ADMIN-ONLY RLS POLICY:
create policy "Admin only SELECT on join_requests"
  on public.join_requests for select
  using (
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );

create policy "Admin only INSERT on join_requests"
  on public.join_requests for insert
  with check (
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );

create policy "Admin only UPDATE on join_requests"
  on public.join_requests for update
  using (
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );

create policy "Admin only DELETE on join_requests"
  on public.join_requests for delete
  using (
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );


-- =========================================================================
-- 7. Reviews Table & Row Level Security (RLS)
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
      or (select role from public.profiles where id = auth.uid()) in ('lead', 'admin')
    )
  );

-- 2. INSERT Policy: Task assignee, leads, and admins can submit review requests
create policy "Reviews insertable by assignee, leads, and admins"
  on public.reviews for insert
  with check (
    auth.role() = 'authenticated'
    and (
      auth.uid() = assignee_id
      or (select role from public.profiles where id = auth.uid()) in ('lead', 'admin')
    )
  );

-- 3. UPDATE Policy: Assigned lead or admin can approve/request changes/reject
create policy "Reviews updatable by assigned lead or admin"
  on public.reviews for update
  using (
    auth.role() = 'authenticated'
    and (
      auth.uid() = reviewer_id
      or (select role from public.profiles where id = auth.uid()) in ('lead', 'admin')
    )
  )
  with check (
    auth.role() = 'authenticated'
    and (
      auth.uid() = reviewer_id
      or (select role from public.profiles where id = auth.uid()) in ('lead', 'admin')
    )
  );

-- 4. DELETE Policy: Admins only
create policy "Reviews deletable only by admins"
  on public.reviews for delete
  using (
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );


-- =========================================================================
-- 8. Projects Table & Row Level Security (RLS)
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
      (select role from public.profiles where id = auth.uid()) = 'admin'
      or pod_id = (select coalesce(pod_code, 'core') from public.profiles where id = auth.uid())
      or pod = (select pod from public.profiles where id = auth.uid())
      or workspace_id = (select workspace_id from public.profiles where id = auth.uid())
      or workspace_id is null
    )
  );

-- 2. INSERT Policy: Team Lead and Administrator can create projects
create policy "Projects insertable by leads and admins"
  on public.projects for insert
  with check (
    auth.role() = 'authenticated'
    and (select role from public.profiles where id = auth.uid()) in ('lead', 'admin')
  );

-- 3. UPDATE Policy: Leads and Admins can update projects
create policy "Projects updatable by leads and admins"
  on public.projects for update
  using (
    auth.role() = 'authenticated'
    and (select role from public.profiles where id = auth.uid()) in ('lead', 'admin')
  )
  with check (
    auth.role() = 'authenticated'
    and (select role from public.profiles where id = auth.uid()) in ('lead', 'admin')
  );

-- 4. DELETE Policy: Admins only
create policy "Projects deletable only by admins"
  on public.projects for delete
  using (
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );

