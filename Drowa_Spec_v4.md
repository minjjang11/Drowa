# Drowa — Product Spec v4

> **Drowa** — the collaborative AI build platform where an AI team builds, reviews, and ships with you.
> "Not an AI that just codes what you ask — an AI team that makes it actually work."

> v4 supersedes v3. Vision, core loop, and design direction are unchanged from v3 and restated briefly
> here; the substance of v4 is the **current reality**: what's actually built, and the one hard blocker
> (preview runtime) that now defines the roadmap. v2/v3 retained as history.

---

## 0. North Star (unchanged)

**Let people build real things without the grind.**
1. **Built for a duo** — developer + designer, each with their own AI, on one screen, one shared context.
2. **An AI team, not one AI** — multiple models, each doing what it's best at, checking each other.

Core loop (never break it): **Prompt → Generate → See it → Refine → Ship.**

---

## 1. Status snapshot (current — 2026-06-07)

| Phase | What | State |
|---|---|---|
| Phase 1 | Core: AI gen, dual chat, shared context, preview, Supabase | ✅ done |
| Phase 2 | Visual editor, MD editor, toolbar, drawers | ✅ done |
| Phase 3 | Design system, templates, inspiration, quick actions, auto-fix, GitHub import, visual↔code, version history | ✅ done |
| Phase 3.5 | Workflow audit, progressive disclosure, tooltips, KO/EN i18n, perf, **light theme redesign** | ✅ done |
| Phase 4-A | Rendering engine — iframe + esbuild + WebContainer | ✅ built, ⚠️ **WebContainer walled for SSR-auth apps** (see §4) |
| Phase 4-B | Multi-AI agent team (pipeline, providers, fallback) | ✅ built (commit `e38a39a`) |
| Phase 4-C | Agent activity UI (`AgentActivityStrip`) | ✅ built |
| **Plan B** | **Real cloud-sandbox preview (replaces WebContainer for full-stack apps)** | 🔜 **next — design in progress** |
| Phase 5 | Sales: hire team members, billing, multi-project, real deploy | later |

**Build health:** `npm run build` green. Default branch `main`, auto-deploys to Vercel.
Deployed: https://drowa-bice.vercel.app

---

## 2. Design direction — sophisticated light theme (current, unchanged from v3)

Warm-light, editorial, premium. Page `#f8f7f4` / surface `#fff` / highlight `#f0ece4`;
accent **near-black `#1a1a1a`** (white text on it); border `rgba(0,0,0,.08)`; error `#dc2626`,
success `#16a34a`. **Liquid glass** (frosted white, `backdrop-blur`) on toolbar, chat panels, property
panel, floating toolbar, modals. Type: **Instrument Serif italic** display + Geist Sans/Mono.
Avoid: blue/indigo, pure-white bg, dark surfaces (except code), heavy shadows, gradient accents.

---

## 3. Architecture (as built)

```
Workspace (3 columns)
  ├─ Developer AI chat (left)        role badge [DEV] amber→now near-black
  ├─ Preview (center)                runtime chosen by decidePreviewRuntime()
  └─ Designer AI chat (right)        role badge [DESIGN] pink→cream
  + shared context.md (bottom drawer, single source of truth, realtime)
  + visual editor (select element → PropertyPanel + FloatingToolbar)
  + FileTree rail, Version History, Code/Preview tabs, Page switcher
```

- **AI context injection** (`src/lib/claude.ts`): frozen system prompt + `context.md` (both cached) +
  current page source + last N channel messages + user prompt. Never full history.
- **Files** stored in Supabase `files` table (`unique(project_id, path)`, RLS, realtime). Multi-page
  authoring via `src/lib/pages.ts` (home = `App.tsx`, extra = `pages/<slug>.tsx`).
- **Visual↔code** (`src/lib/jsxTransform.ts`): `data-drowa-line` bridges DOM ↔ source line ↔ code panel.
- **Versions**: `versions` table + `src/lib/versions.ts`; auto-snapshot before AI change / template /
  github sync / auto-fix; manual snapshots protected; restore re-mounts all files.
- **Multi-agent** (`agents.ts` / `agentPipeline.ts` / `agentProviders.ts`): Claude(builder) + GPT(qa) +
  Gemini/Kimi; pipelines `fast` / `reviewed`; provider keys in env with graceful fallback to Claude;
  `agent_runs` table; `AgentActivityStrip` shows live status.

---

## 4. Preview runtime — the central problem (current truth)

### What's built
`src/lib/previewRuntime.ts` → `decidePreviewRuntime(files)` picks one of three modes:

| Mode | When | How |
|---|---|---|
| `iframe` | single self-contained file | React UMD + Babel in a sandboxed iframe |
| `esbuild` | multi-file front-end / local imports | `esbuild-wasm` in-browser bundle (`EsbuildPreview`) |
| `webcontainer` | server app detected (`next`, api routes, express…) | `@webcontainer/api` runs Node in the browser (`WebContainerPreview`) |

`WebContainerPreview` runs every stack through its **dev server** (`next dev -H 0.0.0.0` / `vite --host`),
injects a public-only `.env.local`/`.env` from `projects.preview_env`, installs (`npm ci` if lockfile),
and offers Retry + an explicit "Quick preview (no backend)" esbuild fallback. WebContainer failures are
**not** silently flattened to a misleading single-page render.

### The wall (proven 2026-06-07 — full detail in `docs/superpowers/specs/2026-06-07-preview-runtime-investigation-and-cloud-sandbox-direction.md`)
Imported **full-stack apps that read auth cookies** (Next + Supabase server client) throw
`cookies was called outside a request scope` **only inside the browser WebContainer** — never on real Node.
Root cause: WebContainer's emulated Node loses the request-scoped `AsyncLocalStorage` through the deferred
RSC render. Verified by running the actual imported app (`pacemaker`, Next 14.2.35) on real Node → HTTP 200,
clean. **No code/config fix exists** — the app is correct; the browser runtime is the limit. `force-dynamic`
injection was tried and reverted (dead weight; also breaks Next 16 `cacheComponents` apps).

### What still works
iframe + esbuild + Vite/`next dev` front-end previews; static/SPA/multi-file; HMR; one broken page no
longer kills the whole preview.

### Plan B — real cloud sandbox (next)
Replace the browser WebContainer with a **real cloud container (real Node)** for full-stack apps so
imported repos (Next + Supabase auth) actually run — the same approach Lovable/Replit/Manus use.
Slots in as a new `PreviewRuntimeMode` routed from the existing `hasServerRuntime` branch; iframe/esbuild
stay for non-server apps. **Open design questions:** spike-vs-production scope; provider
(E2B / Fly Machines / Vercel Sandbox / Daytona / Modal); file + `preview_env` sync; preview surfacing
(sandbox URL iframe vs proxy); lifecycle/cost/teardown; integration + fallback.

---

## 5. Multi-AI agent team (as built, target shape)

User sees one chat; internally a team collaborates. Model assignments (target): Claude = builder +
architecture; GPT = QA + review; Gemini = UX/visual; Kimi = full-context analyst; Perplexity = research.
Pipelines: simple edit → builder only (speed); new feature → reviewed pipeline. Missing provider key →
role falls back to Claude. No per-seat gating yet (just the two of us).

Agent activity UI = compact liquid-glass strip: dot + Instrument-Serif name + Geist-Mono one-line status;
active pulses, idle dims; dual-agent "judging…" → "✓ chosen (reason)". Built billing-ready (a "team
member" is a nameable identity) but billing off.

---

## 6. Self-editing Drowa
Drowa is a GitHub repo. Improving Drowa = import the Drowa repo via existing GitHub import → edit → push.
No separate self-improvement system. (Drowa is itself a full Next.js app → it's exactly the SSR-auth case
that needs Plan B to preview itself.)

---

## 7. Tech stack (current)

| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) + TypeScript |
| Hosting | Vercel (auto-deploy `main`) |
| DB / Auth / Realtime | Supabase (`@supabase/ssr`) |
| AI | Claude (default `claude-sonnet-4-6` via `ANTHROPIC_MODEL`), GPT, Gemini, Kimi; Perplexity planned |
| Preview | iframe + `esbuild-wasm` + `@webcontainer/api` (→ cloud sandbox via Plan B) |
| Code editor | Monaco (`@monaco-editor/react`) — ContextEditor + DiffModal |
| Auth | Google OAuth + email/password; `/auth/callback` PKCE; `src/proxy.ts` (Next 16 middleware) |
| Import | GitHub API (OAuth) |
| i18n | `src/lib/i18n.tsx` KO/EN, localStorage `drowa-lang` |
| Fonts | Instrument Serif, Geist Sans, Geist Mono |

---

## 8. Data model (as built / planned)

```
-- core
projects(id, name, owner, preview_env, …)
project_members(project_id, user_id, role)          -- is_project_member() SECURITY DEFINER (no RLS recursion)
files(project_id, path, content, updated_at)         -- unique(project_id,path), realtime, idx(project_id,updated_at)
context_md(project_id, content)                      -- realtime
messages(project_id, user_id, role, …)               -- role = channel dev_ai/design_ai
versions(project_id, snapshot jsonb, label, "trigger", created_by, created_at)
invites(token, role, created_by, used_by, expires_at)  -- get_invite()/accept_invite() SECURITY DEFINER
github_links(...)
-- agent system
agent_runs(project_id, message_id, role, model, status, chosen, created_at)   -- (schema may need apply; wrapped in try/catch)
-- planned
agent_members(...)  preview_runtime(project_id, mode, last_boot_at)
```

⚠️ Setup: run `supabase/schema.sql` (preview_env, versions, invites, agent_runs columns), disable email
confirm for dev, fill `.env.local`. Google OAuth redirect URI = the **Supabase** callback, not Vercel.

---

## 9. Scope protection (unchanged)
- ❌ Build Guard / pre-code approval gate — removed (friction).
- ❌ Real-time CRDT — locks suffice for two.
- ❌ Hosting arbitrary external services in preview.
- ❌ Per-seat billing before the team-of-AIs experience is loved.

> The spine: **Prompt → Generate (by a team) → See it (real runtime) → Refine → Ship.**
> The one thing standing between "demo" and "real" right now is **See it for full-stack apps** → Plan B.

---

## 10. Immediate next
1. **Plan B design** (cloud-sandbox preview) — brainstorming in progress; spec + plan to follow.
2. Then implement, routing the `hasServerRuntime` branch to the sandbox while keeping iframe/esbuild.
3. Carry-over backlog: zip export, real Vercel deploy API, bundler name-collision handling, translate
   Home page, multi-page deploy/standalone (currently bundles home page only).
