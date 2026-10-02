# TeamHub — Project Status Document

**Last Updated:** October 2026  
**Status:** Alpha / Core Functional Prototype  
**Audience:** Team Members, Project Stakeholders, Academic Supervisors, Incoming Developers  
**Location:** `r:\Github\TeamHub\TeamHUB\PROJECT_STATUS.md`

---

## 1. Overview

**TeamHub** is a unified, engineering-first team collaboration and workspace platform engineered to bridge the gap between real-time team communication, sprint task tracking, and contextual knowledge exchange. It synthesizes core patterns from Slack (channels and messaging), Jira (Kanban task boards and sprint tracking), Stack Overflow (structured team Q&A), and Notion (shared technical documentation and RFC reviews) into a single cohesive interface. The application is built using a modern frontend stack of **React 19**, **TypeScript**, and **Vite**, styled with custom **Tailwind CSS v4** design tokens, and backed by a **Supabase** backend (PostgreSQL, Row-Level Security policies, and Realtime database listeners). An intelligent workspace co-pilot is integrated across the application using a multi-tier AI fallback engine (**OpenAI GPT-4o-mini**, **Google Gemini 3.8/3.7 Flash**, **Groq LLaMA-3/GPT-OSS**, and contextual simulated offline fallbacks), engineered and developed through **Google Antigravity**.

---

## 2. Ready to Use

Every feature listed below has been implemented, verified by direct code audit, connected to live database state, and confirmed to render genuine empty states when the database contains zero records:

### Auth & Roles
- **Account Registration & Login:** Team members can create accounts or sign in securely using email and password credentials backed by Supabase Auth.
- **Role Enforcement:** Users are assigned distinct roles (`admin`, `lead`, `member`, `guest`) that automatically show or hide privileged management features.
- **Approval Queue:** New account registrations can be placed in an intermediate "Waiting for Approval" screen until an administrator grants access.
- **Session Sign-Out:** Users can safely log out from the user menu, which clears active credentials and returns to the login screen.

### Tasks & Sprint Board
- **Mount-Time Database Fetch:** Queries the Supabase `tasks` table on mount via `fetchTasksFromDb()`, initializing state with an empty array `[]` rather than static mock seeds.
- **Realtime Multi-Tab & Multi-Client Sync:** Subscribes to Supabase Realtime `postgres_changes` on the `tasks` table alongside a cross-tab `BroadcastChannel('teamhub_tasks_bus')`, dynamically updating the Kanban board across open sessions when tasks are moved, created, or edited.
- **Four-Column Board Layout:** Visual workflow across four status columns (`To Do`, `In Progress`, `Review`, `Done`) with live status count badges and priority indicators.
- **Verified Empty State:** Displays a dedicated empty state card ("No tasks on your plate — You're all caught up on your assignments for this sprint") when the database returns 0 tasks.
- **Task Creation & Persistence:** Team members can create tasks with auto-generated issue keys (e.g., `#task-104`), descriptions, priority levels, and assignees, persisting them via `createTaskInDb`.
- **Status Transitions:** Changing task status updates component state and triggers `updateTaskInDb` with visual Supabase error notifications if permissions fail.

### Channels & Team Communication
- **Live Database-Backed Feed:** `fetchMessagesFromDb()` queries the Supabase `channel_messages` table and returns an empty array `[]` on legitimate 0-row results without falling back to mock messages.
- **Zero Mock Seed Fallback:** `getLocalChannels()` and `getLocalMessagesByChannel()` return empty collections (`[]` and `{}`) when local storage is uninitialized, eliminating static channel seeds.
- **Channel Navigation:** A dedicated sidebar lists active channels and allows switching between discussion streams.
- **Real-Time Data Layer:** Messages are queried from Supabase PostgreSQL tables and updated live across open browser tabs via Supabase Realtime listeners.

### Knowledge Exchange (Q&A)
- **Live Question & Answer Persistence:** Both new question creation and answer submissions trigger real database `INSERT` mutations into `questions` and `question_answers` tables via `createQuestionInDb()` and `createAnswerInDb()`, updating state with real database records.
- **Mount-Time Database Fetch:** Loads question records and associated answers on mount via `fetchQuestionsFromDb()` from Supabase, initializing with `[]`.
- **Cross-Session Realtime Sync:** Subscribes to Supabase Realtime `postgres_changes` on `questions` and `question_answers` plus cross-tab broadcast synchronization.
- **Verified Empty State:** Displays a dedicated empty state screen ("No questions asked yet — Be the first to ask your team a question or spark an architectural discussion") when the database has 0 questions.
- **Topic & Status Filtering:** Filter questions by status tabs (`open`, `answered`, `resolved`, `my`), topic tags (`#backend`, `#frontend`, `#infra`, etc.), search query, and an unanswered checkbox.
- **Interactive Question Detail:** Teammates can select question cards to view context, code snippets, AI summaries, and answer threads.

### Files & Specs
- **Mount-Time Database Fetch:** Loads files on mount from the Supabase `workspace_files` table via `fetchWorkspaceFilesFromDb()`, joining uploader profile metadata.
- **Zero Mock Seed Fallback:** `getLocalFiles()` returns `[]` when localStorage has nothing, removing static `WORKSPACE_FILES` fallback seeds.
- **Dual Verified Empty States:** When 0 files exist, both the main file stage ("No files in this workspace — Upload your engineering specifications...") and the persistent right inspector panel ("No file selected — Select a file from the workspace...") render clean, dedicated empty states without runtime crashes.
- **Document Previews & Actions:** In-app markdown preview stage, diagram visualizer with zoom controls, file downloads, and share link copying.

### Reviews (RFC & Code Inspection)
- **Role-Gated Hub:** Central review dashboard restricted exclusively to `lead` and `admin` roles in navigation.
- **Mount-Time Database Fetch:** Queries the Supabase `reviews` table via `fetchReviewsFromDb(currentUser)`, applying client-side and database role filters.
- **Verified Empty State:** When the database returns 0 reviews, `fetchReviewsFromDb` returns `[]` without falling back to `INITIAL_REVIEWS`, and `ReviewsView` renders the confirmed empty state ("All caught up! Nothing to review right now.").
- **Review Inspection & Filtering:** Filter reviews by status tabs (`pending`, `approved`, `changes`), search queries, pod filters, and lead assignees.

### Home Dashboard (Projects & Pod Overview)
- **Live Multi-Collection Database Fetch:** Queries `fetchProjectsFromDb`, `fetchTasksFromDb`, `fetchJoinRequestsFromDb`, and `fetchStandupsFromDb` on mount with all `.length > 0` mock fallback guards removed.
- **Zero Seed Defaults:** All dashboard state stores (`tasks`, `allTasks`, `projects`, `standups`, `joinRequests`) initialize to empty arrays `[]`.
- **Quadruple Verified Empty States:** Renders dedicated empty states for every dashboard section when database collections have 0 rows:
  - Active Projects: "No active projects — Projects created for your pod will appear here."
  - Priority Tasks: "No priority tasks for today — You're all caught up on your active deliverables."
  - Pending Join Requests: "No pending join requests — All new member registrations have been reviewed."
  - Daily Standups: "No standup updates posted today — Daily standup check-ins from pod members will appear here."

### My Work
- **Live User-Scoped Database Fetch:** Queries `fetchTasksFromDb()`, `fetchStandupsFromDb()`, and `fetchWorkspaceFilesFromDb()` on mount, scoped specifically to the current user's profile.
- **Dynamic Standup Form:** Replaces hardcoded mock standup strings with real data from the user's active standup entry or derives drafts from their assigned tasks in Supabase; remains empty when no records exist.
- **Triple Verified Empty States:** Confirmed empty states for user assignments ("No active tasks"), completed deliverables timeline ("No completed deliverables yet"), and authored files ("No authored files yet").
- **Dynamic Sprint Velocity:** Sprint completion count and progress percentage are calculated live from the user's real task records (`0 of 0 tasks completed` with `0% pace` on empty state).

### Projects & Milestones
- **Portfolio Health Dashboard:** High-level project cards displaying status badges (`On Track`, `At Risk`, `Delayed`).
- **Progress Tracking:** Dynamic completion progress bars, target milestone dates, and assigned pod contributors.

### AI Assistant Co-Pilot
- **Full View & Global Drawer:** The assistant can be used either as a dedicated full-page screen or as a quick slide-out drawer from any page.
- **Live Workspace Context:** The assistant automatically reads active sprint tasks, recent `#design` messages, and open Q&A threads before responding.
- **Rich Output Formatting:** Generates syntax-highlighted code blocks, structured markdown bullet points, and single-click copy buttons.
- **Multi-Tier Provider Chain:** A resilient four-stage fallback engine (`OpenAI` → `Gemini Primary` → `Gemini Fallback` → `Groq` → `Offline Simulation`) ensures users receive helpful responses even if individual AI providers experience outages.

### Profile & Settings
- **User Profile Page:** View account information, assigned pod code, role level, and team department.
- **Avatar Photo Cropper:** Built-in modal allowing users to upload, pan, zoom, and crop their profile photo.
- **Appearance & Theme Toggles:** Users can switch between dark mode and light mode, with preferences saved locally.

### Admin Console
- **Member Directory:** Administrators can view a complete roster of all registered organization users.
- **Join Request Moderation:** Administrators can review and approve pending user registrations and manage roles.

---

## 3. Needs Further Work

Features that are currently functional but require refinement, edge-case handling, or bug fixes:

1. **AI API Quota & Billing Dependency:**
   - *What works:* The provider chain seamlessly tries OpenAI first, falls back to Gemini on failure, cascades to Groq if Gemini is overloaded, and uses simulated offline responses if all fail.
   - *What needs work:* When using unpaid or free-tier keys, OpenAI returns HTTP 429 (`insufficient_quota` / credit balance exhausted), and Gemini experiences temporary HTTP 503 (`Service Unavailable / High Demand`) throttling during peak hours. Live production use requires accounts with paid API credits.
2. **Channel Slug vs. Database ID Lookups:**
   - *What works:* Channels load and display messages correctly in the user interface.
   - *What needs work:* Certain background queries (such as workspace context generation in `src/lib/gemini.ts`) currently query the `#design` channel using its string slug rather than its database UUID, which can fail if channels are renamed.
3. **Client-Side Secret Exposure:**
   - *What works:* Direct browser `fetch()` requests allow the web app to function without a dedicated custom backend server.
   - *What needs work:* All `VITE_*` API keys are bundled into the browser JavaScript. In production, these calls must be moved behind a server-side proxy or Supabase Edge Function to prevent public exposure of credentials.
4. **Reviews Table Migration Dependency:**
   - *What works:* `fetchReviewsFromDb` returns `[]` on empty queries and renders the verified empty state ("All caught up!").
   - *What needs work:* Review approval actions (`submitReviewDecision`) fall back to local storage if the optional `reviews` SQL table migration has not been manually applied to the Supabase database.

---

## 4. Not Yet Implemented / Planned for Future

Features discussed during planning or suggested by placeholder UI buttons that have not yet been built:

- **Formatting Toolbar Auto-Insert:** While the channel chat bar includes visual formatting icons (bold, italic, code snippet, link), clicking them in the AI drawer or secondary chat inputs does not yet auto-wrap selected text with markdown tags at the cursor position.
- **Voice Dictation Integration:** The microphone icons visible in the AI Assistant inputs are visual placeholders; browser Web Speech API voice-to-text transcription has not yet been integrated.
- **Chat Binary Attachment Dropzone:** The paperclip attachment icon in chat bars currently appends placeholder text labels rather than uploading actual binary files to Supabase Storage.
- **Document Exporting:** Direct one-click exporting of generated AI documentation drafts to external third-party tools (such as Notion, Confluence, or downloadable PDF files) is not yet implemented.
- **Deep Full-Text Global Search:** The `Cmd+K` Command Palette currently offers quick navigation between screens; full-text indexing across historical message transcripts and closed tickets remains planned for a future release.

---

## 5. Known Technical Debt

- **Reliance on Free-Tier AI Quotas:** Free-tier Gemini and Groq API keys have aggressive rate limits (RPM/TPM) and peak-time capacity limits that trigger failovers under rapid typing. Upgrading to standard pay-as-you-go tiers is essential before team onboarding.
- **Manual Database Migrations:** Database schema updates (`supabase_schema.sql`, `000_schema_sync.sql`, `001_channels_uuid_migration.sql`) exist as standalone SQL files that must be manually pasted and executed in the Supabase SQL Editor rather than being applied automatically via a continuous migration pipeline.
- **Hardcoded Workspace Channel Context:** Context compilation in `src/lib/gemini.ts` hardcodes a fetch to the `'design'` channel. It should be refactored to dynamically fetch messages from the user's currently active channel.
- **NPM Peer Dependency Flags:** Running `npm install` requires the `--legacy-peer-deps` flag due to an upstream version mismatch between `@tailwindcss/vite` and `esbuild@0.25`.
- **Secondary Nested Repository Folder:** An untracked `TeamHub/` nested subfolder containing legacy git tracking files exists in the root directory and should be purged in a maintenance cleanup.

---

## 6. Requirements to Go Live

Checklist of requirements before deploying TeamHub for use by a real engineering team:

### Environment Variables
Configure the following in the production hosting provider's dashboard (e.g. Vercel, Netlify, or Cloudflare Pages):
```env
VITE_SUPABASE_URL=https://<your-supabase-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-public-key>
VITE_OPENAI_API_KEY=<your-openai-api-key>
VITE_OPENAI_MODEL=gpt-4o-mini
VITE_GEMINI_API_KEY=<your-google-ai-studio-api-key>
VITE_GEMINI_PRIMARY_MODEL=gemini-3.8-flash
VITE_GEMINI_FALLBACK_MODEL=gemini-3.7-flash
VITE_GROQ_API_KEY=<your-groq-api-key>
VITE_GROQ_MODEL=openai/gpt-oss-120b
APP_URL=https://teamhub.yourcompany.com
```

### Supabase Project Setup
1. **Apply Database Schemas:**
   - Execute `supabase_schema.sql` in the Supabase SQL Editor.
   - Run `000_schema_sync.sql` and `001_channels_uuid_migration.sql` to ensure all foreign keys and UUID schemas are active.
2. **Re-Enable Email Confirmation:**
   - Under *Authentication → Providers → Email*, turn **Confirm email** ON (this was turned off for rapid development testing).
3. **Configure Redirect URLs:**
   - Set the *Site URL* and *Additional Redirect URLs* to your live production domain (`https://teamhub.yourcompany.com`).
4. **Create Storage Buckets:**
   - Create public storage buckets named `avatars` and `workspace-files`.
   - Apply Row-Level Security policies allowing authenticated users to upload and read assets.
5. **Verify Row-Level Security (RLS):**
   - Confirm that RLS is enabled on all tables (`tasks`, `channels`, `channel_messages`, `questions`, `workspace_files`, `reviews`, `projects`, `profiles`).

### API Key Requirements
- **OpenAI:** An active OpenAI platform account with paid credits configured to prevent HTTP 429 quota exhaustion.
- **Google AI Studio:** A Gemini API key with billing enabled to avoid peak-demand HTTP 503 throttling.
- **Groq Cloud:** A verified Groq Cloud API key for high-speed fallback processing.

### Production Build & Deployment
1. Run the production build command:
   ```bash
   npm run build
   ```
2. Verify that static production assets compile without errors into the `dist/` directory.
3. Configure the static web host with single-page application (SPA) rewrite rules so that all route requests serve `dist/index.html` (e.g., `/* -> /index.html 200`).
4. **Production Security Hardening:** Migrate client-side AI completions from direct browser `fetch()` calls to a Supabase Edge Function to protect API keys from client inspection.
