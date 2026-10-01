# TeamHub — Project Status Document

**Last Updated:** October 2026  
**Status:** Alpha / Core Functional Prototype  
**Audience:** Team Members, Project Stakeholders, Academic Supervisors, Incoming Developers  

---

## 1. Overview

**TeamHub** is a unified, engineering-first team collaboration and workspace platform engineered to bridge the gap between real-time team communication, sprint task tracking, and contextual knowledge exchange. It synthesizes core patterns from Slack (channels and messaging), Jira (Kanban task boards and sprint tracking), Stack Overflow (structured team Q&A), and Notion (shared documentation and RFC reviews) into a unified interface. The technical stack is built with modern **React 19**, **TypeScript**, and **Vite** on the frontend, styled with custom **Tailwind CSS v4** design tokens, and backed by **Supabase** (PostgreSQL, Row-Level Security policies, and Realtime database listeners). An intelligent workspace co-pilot is integrated across the application using a multi-tier AI fallback engine (**OpenAI GPT-4o-mini**, **Google Gemini 3.8/3.7 Flash**, **Groq LLaMA-3/GPT-OSS**, and contextual offline fallbacks), engineered and developed through **Google Antigravity**.

---

## 2. Ready to Use

Every feature listed below has been implemented, connected to live database state or reactive stores, and passed functional testing:

### Auth & Roles
- **Account Registration & Login:** Email/password authentication flow with session persistence via Supabase Auth.
- **Role Enforcement:** Distinct role boundaries (`admin`, `lead`, `member`, `guest`) restricting privileged controls such as user management and channel deletion.
- **Approval Queue:** New member registration support with an intermediate "Waiting for Approval" screen before access is granted.
- **Clean Sign-Out:** Instant session invalidation and cache clearing via the user menu.

### Tasks & Sprint Board
- **Interactive Kanban Board:** Visual four-column workflow (`Backlog`, `In Progress`, `In Review`, `Done`) with real-time status transitions.
- **Task Creation & Metadata:** Modals to create tasks with auto-generated issue keys (e.g. `ENG-1042`), markdown descriptions, priority tags (Urgent, High, Medium, Low), and sprint assignment.
- **Assignee Routing:** Dynamic assignment of tasks to registered team members with real-time avatar indicators.
- **Empty States:** Graceful empty states when a column or backlog contains zero tasks.

### Channels & Team Communication
- **Channel Navigation:** Dedicated channel list with default channels (e.g. `#general`) and custom channel creation.
- **Message Feed:** Chronological message timelines with author identity, timestamp, formatted text, and auto-scrolling.
- **Real-Time Data Layer:** Channel messages query Supabase PostgreSQL tables with automatic fallback handling.

### Knowledge Exchange (Q&A)
- **Threaded Problem Solving:** Discussion board for technical questions, blockers, and architecture inquiries.
- **Status Lifecycle:** Questions trackable by status (`Open`, `Solved`, `Under Investigation`).
- **Answer Submissions:** Community answer threads with helpfulness flags and author details.
- **Database Synchronization:** Live querying of questions and answers from Supabase with zero demo-data leaks when empty.

### Reviews (RFC & Code Inspection)
- **Review Dashboard:** Centralized tracking for architectural RFCs, code pull requests, and design specifications.
- **Reviewer Status:** Clear status tags (`Approved`, `Changes Requested`, `Under Review`) with linked pull request numbers and benchmark references.
- **Empty State Support:** Confirmed proper empty screen rendering when no active reviews exist in the database.

### Projects & Milestones
- **Portfolio Overview:** High-level project tracking cards showing project health (`On Track`, `At Risk`, `Delayed`).
- **Progress Tracking:** Dynamic percentage completion bars, target delivery dates, and assigned pod contributors.

### AI Assistant Co-Pilot
- **Full View & Slide-Out Drawer:** Two interactive modes — a dedicated full-page AI Assistant tab and a slide-out drawer accessible from any view via the global header.
- **Live Database Context Injection:** Automatically aggregates active sprint tasks, recent channel discussions, and open Q&A threads directly into the prompt context.
- **Markdown & Code Rendering:** Syntax-highlighted responses, bullet-point formatting, copy-to-clipboard buttons, and prompt regeneration.
- **Multi-Tier Provider Chain:** Resilient fallback engine traversing OpenAI → Gemini Primary → Gemini Fallback → Groq → Contextual simulated fallback.

### Profile & Settings
- **User Profile Management:** View personal account details, assigned pod codes, and organization roles.
- **Interactive Avatar Cropping:** Built-in modal for uploading, panning, and cropping profile photos.
- **Theme Switching:** System-wide dark mode and high-contrast light mode toggle with local storage persistence.

### Admin Console
- **User Directory:** Administrator-only management table showing all registered organization members.
- **Access Moderation:** Approve pending account join requests and assign organizational team functions.

---

## 3. Needs Further Work

Features that are functional but require refinement, edge-case handling, or bug fixes:

1. **AI Upstream Free-Tier Stability:**
   - *What works:* The client successfully chains requests through OpenAI, Gemini, and Groq, falling back to simulated responses if all fail.
   - *What doesn't:* Free-tier Gemini keys experience severe `503 Service Unavailable / High Demand` throttling during peak usage periods, and OpenAI accounts without paid credits return `429`. Paid tier API accounts are required for uninterrupted operation.
2. **Channel Slug vs. UUID Alignment:**
   - *What works:* Channel listings and message feeds query live database tables.
   - *What doesn't:* Certain contextual lookups (e.g. `src/lib/gemini.ts` lines 40 & 61) query messages using the text slug `'design'`. A complete database migration to UUID-based channel keys is required across all components.
3. **Client-Side Secret Exposure:**
   - *What works:* Direct client-side `fetch()` calls enable instant local testing without needing a standalone backend.
   - *What doesn't:* API keys (`VITE_OPENAI_API_KEY`, `VITE_GEMINI_API_KEY`, `VITE_GROQ_API_KEY`) are bundled into the browser JavaScript. For production, these must run inside a Supabase Edge Function or secure API gateway.
4. **Initial State Hydration Flash:**
   - *What works:* Components load real database data on mount.
   - *What doesn't:* `App.tsx` initializes state collections with static mock constants before asynchronous database queries resolve, occasionally producing a brief momentary flash of placeholder content before live data arrives.

---

## 4. Not Yet Implemented / Planned for Future

Features discussed or indicated in UI layouts that have not yet been built:

- **Rich Text / Formatting Toolbar Auto-Insert:** The chat and AI input bars show standard input controls; visual formatting buttons (bold, italic, code block auto-insertion) are not yet wired to insert markdown tags automatically into the text caret position.
- **Voice Prompt Dictation:** The microphone icon in the AI Drawer and chat inputs is a visual UI element; browser Web Speech API voice-to-text dictation has not yet been integrated.
- **Attachment & Code File Dropzone:** File attachment buttons in chat inputs are placeholders; direct multi-part binary file uploads to Supabase Storage buckets from the chat bar are deferred.
- **Document Export:** Exporting generated AI documentation drafts directly to external services (e.g. Notion, Confluence, or raw PDF/Markdown download) has not yet been built.
- **Global Command Palette Indexing:** `Cmd+K` opens the navigation modal with standard shortcuts, but deep full-text indexing across historical channel transcripts and closed tickets is not yet implemented.

---

## 5. Known Technical Debt

1. **Manual SQL Migration Scripts:**
   - Database schema migrations (`000_schema_sync.sql`, `001_channels_uuid_migration.sql`, etc.) are written as standalone SQL scripts in the repository root and must be manually pasted into the Supabase SQL editor rather than automated via a Supabase CLI migration pipeline.
2. **Hardcoded Context Lookups:**
   - `src/lib/gemini.ts` contains hardcoded references to the `#design` channel slug when compiling background workspace context.
3. **NPM Peer Dependency Conflict:**
   - Running `npm install` requires the `--legacy-peer-deps` flag due to an upstream peer dependency mismatch between `@tailwindcss/vite` and `esbuild@0.25`.
4. **Dual Git Repository Metadata:**
   - An untracked `TeamHub/` subfolder exists at the project root containing legacy `.git` metadata from an earlier local clone, which should be safely purged to avoid confusion.

---

## 6. Requirements to Go Live

To transition TeamHub from local development to a live production deployment accessible to a real team:

### Environment Variables
Configure the following in your hosting provider's environment settings:
- `VITE_SUPABASE_URL`: Active production Supabase project URL (`https://<project-id>.supabase.co`).
- `VITE_SUPABASE_ANON_KEY`: Supabase anon/public API key.
- `VITE_OPENAI_API_KEY`: Production OpenAI API key (with active billing credits).
- `VITE_GEMINI_API_KEY`: Google AI Studio API key with paid quota to prevent 503 drops.
- `VITE_GROQ_API_KEY`: Groq Cloud API key for high-speed fallback completion.
- `APP_URL`: Production domain URL (e.g. `https://teamhub.company.internal`).

### Supabase Project Configuration
1. **Schema Initialization:**
   - Execute `supabase_schema.sql` in the Supabase SQL Editor.
   - Run `000_schema_sync.sql` and `001_channels_uuid_migration.sql` to apply primary foreign keys and UUID schemas.
2. **Auth Settings:**
   - Re-enable **Confirm email** under *Authentication → Providers → Email* (disabled during local dev).
   - Configure **Site URL** and **Redirect URLs** to point to your live deployment domain.
   - Enable rate-limiting on authentication endpoints to prevent credential stuffing.
3. **Storage Buckets:**
   - Verify that the `avatars` and `workspace-files` storage buckets are created and marked as public with appropriate authenticated user write policies.
4. **Security / RLS Auditing:**
   - Confirm that Row-Level Security (RLS) is enabled on all tables (`tasks`, `channels`, `channel_messages`, `questions`, `workspace_files`, `reviews`, `projects`).

### Production Build & Hosting
1. Build the client bundle:
   ```bash
   npm run build
   ```
2. Verify production assets compile cleanly into the `dist/` directory.
3. Deploy static assets to a production edge host (e.g. Vercel, Netlify, Cloudflare Pages, or an AWS S3/CloudFront bucket) configured with single-page application (SPA) routing redirects (`/* -> /index.html`).
