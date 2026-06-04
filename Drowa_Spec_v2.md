# Drowa — Product Spec v2

> **Drowa** — the collaborative AI build platform for a developer + designer duo
> "Everything you'd otherwise search for, connect, and configure — handled inside Drowa."

---

## 0. North Star

Every other AI builder is designed for **one person**. Drowa is designed for **two people with different jobs** — a developer and a designer — building the same thing at once.

And the core promise underneath that:

> **Stop searching, connecting, and configuring. Say what you want — Drowa finds it, builds it, and wires it into your work.**

No more hunting Instagram/Pinterest for design references, googling how to implement them, copy-pasting Tailwind, and starting over when it looks off. That entire loop collapses into the platform.

---

## 1. One-line definition

A web build platform where a **developer and a designer each talk to their own AI on one screen**, working on top of a **shared project context (MD file)**, with **curated design intelligence, templates, and one-click AI skills** built in — so quality output happens without the search-and-configure grind.

---

## 2. Positioning — why Drowa exists

| | Existing tools (Lovable / Bolt / v0 / Replit / Readdy) | Drowa |
|---|---|---|
| Designed for | 1 person | **Dev + Designer duo** |
| AI chat | 1 chat, resets each session | **2 separate chats, shared persistent context** |
| Design quality | Depends on user's prompt skill | **Built-in design system + curated inspiration** |
| Getting good output | Search references → google → copy → tweak | **Say it → Drowa builds it** |
| Context memory | Lost on session exit | **MD file = persistent, editable source of truth** |
| Collaboration | Share a chat link | **Same screen, real-time** |

**This isn't a Readdy clone.** It's "Figma solved design collaboration → Drowa solves build collaboration."

---

## 3. What we deliberately borrow (best parts of each platform)

Researched and kept only what fits our direction:

- **From Lovable** — full-stack native (Supabase DB/auth/deploy integrated), AI auto-suggests fixes when something breaks
- **From Bolt** — zero-setup in-browser building, automatic error detection during generation
- **From v0** — production-grade components (shadcn-style quality baseline), device preview toggle, clean Code/Preview switch
- **From Replit** — "glass box" code visibility (never hide the code), version control feel
- **From Readdy** — strong default design quality, visual editing, free code export

What we **reject**: single-user assumption, cold dev-tool aesthetic OR generic SaaS look, and the "prompt-skill required" barrier.

---

## 4. Core concept — MD = Single Source of Truth

Every project has a `context.md` — **the AI's memory and our working reference at once.**

```
                    context.md
                  (the project brain)
                        │
        ┌───────────────┼───────────────┐
        │               │               │
   Developer AI     Designer AI       Preview
   (code logic)      (UI/design)      (output)
        │               │               │
        └───────────────┴───────────────┘
            everyone reads & writes the same MD
```

**Context injection (kept lightweight):**
```
Context sent to AI =
  context.md (summary)         ← always
  + design system tokens       ← always (ensures consistent output)
  + current file code          ← always
  + last N messages (e.g. 6)   ← chat continuity
```

After every successful generation, AI appends a changelog line to `context.md` → it becomes a living project log.

---

## 5. Layout

```
┌────────────────────────────────────────────────────────────┐
│ Drowa  [project name ✎]   [Desktop|Tablet|Mobile]  ●Ready  [Export][Deploy] │
├──────┬───────────┬──────────────────────┬───────────┬───────┤
│ File │ Developer │     LIVE PREVIEW      │ Designer  │ Prop  │
│ tree │ AI chat   │     (iframe, hero)    │ AI chat   │ panel │
│      │           │                       │           │(slide)│
│ ⊟    │ Quick     │  click → highlight    │ Quick     │       │
│      │ Actions   │  code + show toolbar  │ Actions   │       │
│      │ bar       │  drag → reposition    │ bar       │       │
├──────┴───────────┴──────────────────────┴───────────┴───────┤
│ context.md   ✎ Edit   (collapsible drawer, Preview↔Raw)      │
└────────────────────────────────────────────────────────────┘
```

- Chat panels = collapsible side drawers (preview is always the hero)
- File tree = collapsible left rail (Replit-style)
- Property panel = slides in from right on element selection
- MD editor = bottom drawer, collapsed by default

---

## 6. Design direction — "What if Figma built an IDE"

Premium creative-tool energy. Warm, deep, tactile. Unlike any current builder.

**Palette**
- Background `#0d0d0d` (warm near-black) / Surface `#141414` / Elevated `#1a1a1a`
- Border `#2a2a2a`, highlight = gradient `linear-gradient(135deg, #f59e0b, #ec4899, #8b5cf6)`
- Accent: amber `#f59e0b` + pink `#ec4899`
- Text: warm white `#f5f5f0` / warm grey `#888880`

**Typography (the differentiator)**
- Display: serif (Playfair Display / DM Serif Display) — unexpected for a dev tool
- UI: Geist Sans / Code: Geist Mono
- The serif + mono mix is the signature

**Texture & depth**
- Subtle noise overlay (3–5% opacity), gradient borders on key panels
- Amber focus glow on inputs, amber pulse on "Generating" status

**Avoid:** blue/indigo accent, pure white bg, cold greys, bouncy animations, generic SaaS feel.

---

## 7. Feature spec

### ✅ Phase 1 (done)
AI code gen, separate chats + shared context, iframe preview, context.md auto-gen, Supabase auth/storage/realtime.

### ✅ Phase 2 (done)
Visual editor (click → property panel, drag → reposition), in-app MD editor, toolbar (device toggle, status pill), collapsible drawers, file tree, Code/Preview tabs.

### 🔜 Phase 3 — "Stop searching and configuring"

**3-1. Design System engine**
- Per-project tokens: color / typography / spacing / radius
- AI **always** generates against these tokens → consistent output regardless of prompt quality
- This is the root fix for "AI design comes out ugly"

**3-2. Component & Template Library**
- Section-level templates: Hero / Pricing / Dashboard / Card / Form / Nav
- Click → inserted into preview, already styled to the design system
- After insert: "make this more minimal" etc. via AI, instantly

**3-3. Inspiration Library** (the standout)
- Curated trending UI patterns inside Drowa (bento grid, glassmorphism, layered cards…)
- Save favorites → "build in this style" applies to current work in one click
- **No more hunting Instagram/Pinterest** — the references live in the tool
- Upload a reference image → AI analyzes it → applies the vibe ("Match this style")

**3-4. AI Quick Actions** (one-click skills, no prompt skill needed)
- Buttons sitting above each chat:
  - ✨ Make it premium
  - 📱 Make mobile responsive
  - 🌙 Add dark mode
  - ⚡ Add animations
  - 🎨 Match this style (image upload)
- Lowers the barrier: click instead of knowing how to prompt

**3-5. Auto error detection & fix** (borrowed from Bolt/Lovable)
- On generation, detect render/build errors automatically
- AI proposes a one-click fix — user never debugs blind

**3-6. GitHub import** (bring existing work in)
- GitHub OAuth → list repos → select → import into Drowa `files`
- Edit + AI-assist inside Drowa → commit/push back
- (Vercel projects come in via their connected GitHub repo)

**3-7. Visual ↔ Code linking** (power-user bridge, "glass box")
- Click element in preview → corresponding code highlights in right code panel
- Floating toolbar on selection: Duplicate / Edit / Delete / + Add similar
- "+ Add similar" → AI clones the component into the code
- Edit via the in-platform toolbar → reflected in code → preview re-renders

**3-8. Version history**
- Snapshots at key points, rollback, diff view (highlight changes)

### 📦 Phase 4 — sales-ready (later)
Multi-project workspaces, external user onboarding, billing/subscription, team roles, usage metering.

---

## 8. Phase 3 build order

```
3-1  Design System + stronger AI system prompt   ← foundation (fixes ugly output)
3-2  Component & Template Library                ← immediate usefulness
3-3  Inspiration Library                         ← the differentiator
3-4  AI Quick Actions                            ← UX completion
3-5  Auto error detection & fix                  ← reliability
3-6  GitHub import                               ← existing-user funnel
3-7  Visual ↔ Code linking                       ← power users
3-8  Version history                             ← safety net
```

Build foundation-first: the Design System (3-1) makes everything after it look good by default.

---

## 9. Tech stack

| Area | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Hosting | Vercel |
| DB / Auth / Realtime | Supabase |
| AI | Anthropic Claude API |
| Preview | sandboxed iframe (postMessage bridge) |
| Code editor | Monaco / CodeMirror |
| Auth providers | Google OAuth (+ email) |
| Import | GitHub API (OAuth) |

---

## 10. Data model (Supabase)

```
projects(id, name, owner_id, created_at, updated_at)
project_members(project_id, user_id, role: developer|designer)
files(id, project_id, path, content, updated_at)
context_md(project_id, content, updated_at)            ← source of truth
messages(id, project_id, user_id, role: dev_ai|design_ai, content, created_at)
versions(id, project_id, snapshot jsonb, label, created_at)

-- Phase 3 additions
design_tokens(project_id, tokens jsonb)                ← color/type/spacing/radius
templates(id, name, category, code, preview_url, is_global)
inspirations(id, owner_id, title, image_url, tags, pattern_type, saved_from)
quick_actions(id, label, icon, prompt_template)        ← reusable AI skills
github_links(project_id, repo, branch, access_token_ref)
```

---

## 11. Scope protection (what we are NOT building)

- ❌ Real-time concurrent editing (CRDT) — locks are enough for 2 people
- ❌ Framer/Webflow-level free-form layout dragging
- ❌ Complex permission systems
- ❌ Payments/team features before the core workflow is loved

> **The risk is building everything for 3 months and using nothing. Foundation-first, always shippable.**
