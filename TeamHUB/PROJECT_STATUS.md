# TeamHub — Project Status & Handover Document

## 1. Overview

TeamHub is an all-in-one collaborative workspace and team productivity platform designed for agile teams, student project groups, and cross-functional engineering pods. It combines task management (Kanban boards and list views), structured topic-based communication channels, a persistent team Q&A knowledge base, a shared file repository, code/task review workflows, and an intelligent AI Assistant with live workspace awareness. The application is built with a modern web architecture using **React 19** (with TypeScript and Vite), **Vanilla CSS** coupled with a tailored design system supporting light, midnight dark, and system-adaptive themes, **Supabase** (PostgreSQL, Row-Level Security, and Storage) for backend data and authentication, and a multi-tier AI pipeline powered by **Google Gemini** (Gemini 2.5/2.0 Flash) with automated failover to **Groq** (LLaMA/Mixtral models). TeamHub was architected and developed using the Google DeepMind **Antigravity** agentic AI pair-programming platform.

---

## 2. Ready to Use

Every feature listed below has been tested and verified across real user accounts under three distinct roles: **Administrator**, **Team Lead**, and **Team Member**.

### Auth & Roles
- **3-Step Admin Onboarding:** Administrators can sign up through an account, workspace, and channel creation wizard, with `#general` created automatically as the default channel.
- **Unique Pod Codes:** A unique 8-character pod invitation code (e.g. `TH-4821-ENG`) is generated upon workspace setup, complete with a one-click copy button for inviting teammates.
- **Role-Based Sign-Up:** Team Leads and Team Members can register using a valid pod code and are automatically linked to their assigned workspace and pod.
- **Pod Code Validation:** Invalid or expired pod invitation codes are immediately rejected with clear error guidance.
- **Secure Authentication:** Email/password login and logout work reliably across all three roles; logging out completely clears credentials and active session state.
- **Persistent Sessions:** User sessions and workspace context survive full browser refreshes without logging the user out.
- **Role-Based Landing:** Administrators are directed straight to the Admin Center upon login, while Team Leads and Team Members land on the main workspace dashboard.
- **Access Control & Permissions:** Team Members cannot access the Admin Center, User Management, or the workspace-wide Team tab (routes are blocked and navigation items are hidden).
- **Directory Scoping:** Team Leads only see members belonging to their own pod in the Team directory, while Administrators have full visibility across all workspace members.
- **Server-Side Security (RLS):** Database Row-Level Security protects sensitive data; testing access against restricted tables returns HTTP 200 for Administrators and HTTP 403 Forbidden for Leads and Members.
- **Role Immutability Trigger:** Users cannot elevate their own permissions or alter other accounts; role modifications are guarded by a PostgreSQL database trigger.

### Tasks & Kanban
- **Task Lifecycle Management:** Create, view, update, and advance tasks across four stages: *To Do*, *In Progress*, *Review*, and *Done*.
- **Kanban & List Views:** Seamless toggle between interactive column-based drag-and-drop boards and dense list layouts.
- **Multi-Criteria Filtering:** Live filtering by priority level (Low, Medium, High, Urgent), assigned team member, and keyword search.
- **Task Detail Drawer:** Slide-out inspection drawer supporting checklists/subtasks, threaded comments, and attachment downloads.
- **Role-Scoped Task Assignment:** Team Leads can only assign tasks to members of their own pod; Administrators assign tasks within project scopes, with server-side RLS enforcement.
- **Protected Task Deletion:** Only Team Leads and Administrators can delete tasks; Team Members do not have delete permissions.
- **AI Task Suggestions:** The "Suggest with AI" button in the task drawer recommends checklist items and task breakdowns based on the current title and description.

### Channels & Chat
- **Organized Channels:** Topic-based chat channels with active participant lists and unread message indicators.
- **Role-Guarded Channel Creation:** Only Administrators and Team Leads can create new channels; the creation button is hidden for Team Members.
- **Protected `#general` Channel:** The default `#general` channel is permanently protected and cannot be deleted or renamed by any user.
- **Audited Channel Deletion:** Team Leads and Administrators can delete custom channels, triggering a system audit announcement posted to `#general` recording who performed the deletion and when.
- **Channel-Isolated Message History:** Each channel maintains its own completely isolated conversation history; messages in `#general`, `#development`, `#design`, and custom channels never leak or cross-contaminate.
- **Real-Time Cross-Session Synchronization:** Live chat messages synchronize across multiple browser tabs and sessions in real time via Supabase Realtime WebSockets (`channel_messages:${activeChannelId}`) and BroadcastChannel.
- **Rich Text Composer:** Markdown formatting toolbar allows one-click insertion of bold, italic, inline code, code blocks, bulleted lists, and quotes.

### Questions & Knowledge Base
- **Structured Q&A:** Post technical and operational questions with category tags and project associations.
- **Community Answers & Voting:** Submit answers, upvote helpful responses, and filter questions by status (All, Solved, Unanswered).
- **Persistent Bookmarks & Following:** Bookmark important questions and follow topics for updates; selections persist across page reloads.
- **One-Click Share:** Easily copy a direct link to any question to share with teammates.
- **Draft with AI:** Clicking "Draft with AI" opens the AI Assistant drawer preloaded with the question context to help structure clear answers.

### Files
- **Shared Repository:** Centralized file browser with folder categories (Design, Documents, Code, Media).
- **File Upload & Categorization:** Drag-and-drop file upload modal with automatic type detection and size tracking.
- **Direct Downloads:** Quick-download links for workspace assets.
- **Shareable Links:** Instant one-click link copying to share files with team members.

### Reviews
- **Lead Review Queue:** Team Leads have a dedicated view showing all tasks submitted for review by their pod members.
- **Action Workflow:** Leads can *Approve*, *Request Changes*, or *Reject* tasks, updating task statuses and notifying assignees.
- **Administrator Review Overview:** Administrators can inspect review activity across all pods in the organization with filterable lead and status criteria.

### Projects
- **Scoped Project Creation:** Create dedicated projects linked to specific pods with auto-provisioned project channels (`#project-*`) and task boards.
- **Project-Level Filtering:** Filter tasks, channels, and Q&A entries by specific project names.
- **Progress Tracking:** Dashboard project cards display real-time completion percentages computed directly from completed vs. open tasks.

### AI Assistant
- **Redesigned Modern Experience:** Clean context header with connection telemetry, starter suggestion cards, and dedicated prompt centerpiece.
- **Live Workspace Grounding:** The assistant queries live Supabase tables (tasks, members, projects, channels) to answer contextual questions instead of hallucinating mock data.
- **Multi-Tier Model Resilience:** Automatic fallback pipeline: Primary Gemini (`gemini-2.5-flash`) → Secondary Gemini (`gemini-2.0-flash`) → Groq (`openai/gpt-oss-120b` / `llama-3.3-70b`) ensuring uptime if primary rate limits occur.
- **Rich Markdown & Code Rendering:** Formatted response headers, syntax-highlighted code blocks with one-click copy, and referenced knowledge sources.
- **"Document Our Teamwork":** Quick action synthesizes team progress into a structured markdown report, allows user editing, and saves the result directly into the Files repository.

### Profile & Settings
- **Profile Customization:** Edit display name, phone, bio, technical skills, and social links with persistent storage.
- **Avatar Management:** Upload profile photos, adjust crop alignment, and remove avatars to return to initials using Supabase Storage.
- **Clean Field Schema:** Deprecated portfolio fields have been removed.
- **Password Updates:** In-app password change form with validation and confirmation notices.
- **Theme Switcher:** Instantly switch between *Calm Light*, *Midnight (Dark)*, and *System Match* (dynamically adapts to OS color scheme) with localStorage persistence.

### Administration & Navigation
- **Collapsible Sidebar:** Header toggle smoothly collapses the navigation sidebar to an icon-only mode with tooltips, saving state between sessions.
- **Native Responsive Layout:** Fully responsive layout across mobile and desktop viewports without relying on simulated device wrappers.
- **User Management & CSV Export:** Administrators can view the workspace roster, inspect join requests, approve/decline membership, and export user lists to CSV.

---

## 3. Needs Further Work

The following items are partially functioning, have known caveats, or require follow-up development before a high-concurrency production rollout:

| Area | Feature | Current State | What's Needed |
|---|---|---|---|
| **Database Schema Sync** | Live Schema Baseline Alignment | The live Supabase instance was created prior to recent schema additions; columns such as `channels.deleted_at`, `channels.is_protected`, and `tasks.project_id` exist in [`supabase_schema.sql`](file:///r:/Projects/TeamHUB/supabase_schema.sql) but need to be applied to the remote database via [`000_schema_sync.sql`](file:///r:/Projects/TeamHUB/000_schema_sync.sql). | Run [`000_schema_sync.sql`](file:///r:/Projects/TeamHUB/000_schema_sync.sql) in the Supabase SQL Editor to bring the live database up to baseline parity without dropping existing tables. |
| **Relational Foreign Keys** | Channels & Tasks Foreign Keys | `channels.id` currently uses text slugs (e.g. `'general'`) instead of UUIDs, preventing strict foreign key constraints from `channel_messages(channel_id)` and `tasks(project_id)`. | Execute migration `001_channels_uuid_migration.sql` to adopt UUID primary keys for channels and enforce relational foreign keys across messages and tasks. |
| **Files & Storage** | Direct Cloud Storage Buckets | Avatar uploads store binary images in Supabase Storage (`avatars` bucket). General workspace file uploads fall back to generated data links if the `workspace-files` bucket has not been provisioned. | Ensure the `workspace-files` and `task-attachments` storage buckets exist with public read policies in the Supabase Dashboard. |
| **Notifications** | Persistent Database Notifications | The notification bell displays unread badges and action indicators, but notifications are stored in client memory. | Persist notifications to a dedicated `public.notifications` table in PostgreSQL so alerts sync across devices and survive session clearings. |

---

## 4. Not Yet Implemented / Planned for Future

The following features were discussed during product ideation or deferred for post-launch releases:

1. **Direct 1-on-1 Messaging (DMs):** Private direct messaging between individual team members outside of public channels.
2. **Audio/Video Huddles:** Native WebRTC video/voice calls or embedded Google Meet / Zoom link integrations within channels.
3. **Live User Presence / Typing Indicators:** Green "online/away" status badges on avatars and "Sarah is typing..." indicators in chat channels.
4. **Interactive Markdown Split-Pane Preview:** While markdown formatting tokens insert cleanly into chat and comments, a live side-by-side preview panel has not been added.
5. **@User Mentions with Autocomplete Dropdown:** Typing `@` in chat currently inputs literal text without displaying an interactive floating teammate selector.
6. **Third-Party Integrations:** Automated webhook integrations for GitHub pull request alerts, Figma design comments, or Jira issue syncing.
7. **Daily Standup Summary Bot:** An automated cron or AI background workflow that polls active tasks at 9:00 AM each morning and posts a digest into `#general`.

---

## 5. Known Technical Debt

1. **AI Rate Limiting on Free Tier:**
   - The application relies on free-tier API keys for Google Gemini and Groq. Under heavy concurrent testing or large team usage, Google AI Studio may return HTTP 429 (Rate Limit Exceeded). While the fallback chain successfully reroutes requests to backup models, high-volume production requires upgraded pay-as-you-go API keys.
2. **Manual SQL Schema Execution:**
   - Database migrations are consolidated into raw SQL scripts (`supabase_schema.sql`, `000_schema_sync.sql`, `001_channels_uuid_migration.sql`). Setting up a new environment requires manually running these scripts in the Supabase SQL Editor rather than using an automated CLI migration pipeline (e.g., Supabase CLI / Prisma / Flyway).
3. **Dual Client Fallback State:**
   - To facilitate local development and UI previewing when offline or without active Supabase credentials, several modules in `src/lib/supabase.ts` fall back to `mockData.ts` or `localStorage`. These should be gated behind an explicit `VITE_DEMO_MODE=true` flag so production builds fail cleanly on database errors rather than falling back to mock fixtures.
4. **Database RLS Policies Maintenance:**
   - The SQL schema contains several RLS helper functions (e.g., `current_user_role()`, `current_user_workspace_id()`, `is_valid_task_assignment()`). When adding new tables or expanding role logic, developers must remember to update both front-end route guards and corresponding PostgreSQL policies.

---

## 6. Requirements to Go Live

Before TeamHub can be deployed for a real organization or active team, complete the following deployment checklist:

### Step 1: Supabase Cloud Project Setup
1. Create a new project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in the Supabase dashboard.
3. Execute [000_schema_sync.sql](file:///r:/Projects/TeamHUB/000_schema_sync.sql) (or [supabase_schema.sql](file:///r:/Projects/TeamHUB/supabase_schema.sql)) to create all baseline tables, indexes, triggers, and Row-Level Security policies.
4. Navigate to **Storage** in the Supabase dashboard and create three storage buckets:
   - `avatars` (Public bucket: enabled)
   - `task-attachments` (Public bucket: enabled)
   - `workspace-files` (Public bucket: enabled)
5. Navigate to **Authentication → Providers → Email**:
   - In development, *Confirm Email* was disabled to allow instant test account creation.
   - For production, decide whether to **Enable Email Confirmations** and connect a custom SMTP provider (e.g., SendGrid, Resend, or AWS SES) to avoid Supabase's default rate limit of 3 emails per hour.
6. Under **Authentication → URL Configuration**, add your production domain to *Site URL* and *Redirect URLs*.

### Step 2: External AI API Keys
1. **Google AI Studio:**
   - Generate an API key from [aistudio.google.com](https://aistudio.google.com).
   - Ensure the key has quota for `gemini-2.5-flash` or `gemini-2.0-flash`.
2. **Groq Console:**
   - Generate a free backup API key from [console.groq.com](https://console.groq.com).
   - Ensure access to models such as `llama-3.3-70b-versatile` or `openai/gpt-oss-120b`.

### Step 3: Production Environment Variables
Configure the following secrets in your deployment hosting provider (e.g., Vercel, Netlify, Cloudflare Pages):

```bash
# Supabase Backend Configuration
VITE_SUPABASE_URL="https://YOUR_PROJECT_ID.supabase.co"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"

# Primary & Secondary AI Assistant Keys
VITE_GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
VITE_GROQ_API_KEY="YOUR_GROQ_API_KEY"
GROQ_API_KEY="YOUR_GROQ_API_KEY"

# Optional Model Overrides (defaults to stable versions if omitted)
VITE_GEMINI_PRIMARY_MODEL="gemini-2.5-flash"
VITE_GEMINI_FALLBACK_MODEL="gemini-2.0-flash"
VITE_GROQ_MODEL="openai/gpt-oss-120b"

# Public App Hosting URL
APP_URL="https://your-teamhub-domain.com"
```

### Step 4: Build & Deployment Commands
- **Framework Preset:** Vite / React
- **Install Command:** `npm install`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Single-Page Application (SPA) Routing:** Ensure rewrite rules redirect all paths to `/index.html` (e.g., a `vercel.json` rewrite or `_redirects` file for Netlify).
