# Drowa — Phase 1

Collaborative AI build platform. Developer AI (left) + live preview (center) + Designer AI (right), all working on a shared `context.md`.

## Stack
Next.js (App Router, TS) · Supabase (DB/Auth/Realtime) · Anthropic Claude · sandboxed iframe preview · Tailwind v4.

## Setup

1. **Install**
   ```bash
   npm install
   ```

2. **Supabase**
   - Create a project at supabase.com.
   - SQL editor → run `supabase/schema.sql` (tables, RLS, triggers, realtime publication).
   - Auth → Providers → Email: enable. For 2-user dev, turn **off** "Confirm email" so sign-up logs in immediately.

3. **Env** — copy `.env.example` to `.env.local`, fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...      # reserved (not used in Phase 1 paths)
   ANTHROPIC_API_KEY=sk-ant-...
   ANTHROPIC_MODEL=claude-sonnet-4-6  # optional override
   ```

4. **Run**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 → sign up two users.

## How it works

- **Auth** — email/password via Supabase. `src/middleware.ts` refreshes the session and redirects unauthenticated traffic to `/login`.
- **Projects** — `/` lists/creates projects. Creating one seeds an `App.tsx` file; a DB trigger adds the owner as a `developer` member and creates the `context_md` row.
- **Workspace** (`/project/[id]`) — three panes. Each chat posts to `POST /api/chat`.
- **Claude call** (`src/lib/claude.ts`) — context-injection strategy from the spec:
  - `system` = frozen role prompt **+ context.md** (cached via `cache_control`)
  - current `App.tsx` code (cached)
  - last 6 messages of that channel
  - the new user prompt
  Full chat history is **never** sent.
- **Preview** — the returned `tsx` code block is saved to `files` and rendered in a `sandbox="allow-scripts"` iframe (React UMD + Babel standalone).
- **context.md** — auto-seeded, then each AI code change appends a changelog line. Editable directly in the table (Phase 2: in-app editor).
- **Realtime** — the preview subscribes to `files` changes, so one person's change updates the other's preview.

## Data model
`projects · project_members · files · context_md · messages · versions` — see `supabase/schema.sql`. RLS restricts every row to project members.

## Phase 2 (next)
Click→property panel, drag→position, in-app MD editor, fuller realtime sync. Tables/publication already provisioned.
