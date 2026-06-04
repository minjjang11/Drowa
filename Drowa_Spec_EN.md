# Drowa — Product Spec

> **Drowa** — an AI-built, two-person collaborative build platform
> "Readdy, but a more user-friendly Readdy"

---

## 1. One-line definition

A web build platform where a **developer and a designer each talk to their own AI on one screen**, working on top of a **shared project context (MD file)** to create and refine the same output in real time.

---

## 2. Why build it (vs. Readdy)

| | Readdy | Drowa |
|---|---|---|
| AI chat | 1 user, 1 chat, context resets each time | **Separate chats + shared context** (2 AIs on one screen) |
| Context persistence | Lost when you leave the session | **Persisted as an MD file, directly editable** |
| Collaboration | Have to share the chat | Both work in the same space |
| Visual editing | Limited | **Click-to-edit properties + drag-to-update position** |
| Core philosophy | Feature checklist | **Best possible workflow** |

**Core philosophy:** It's not about having the most features — it's about building the intuitive workflow *we actually want to use*.

---

## 3. Core concept — MD = Single Source of Truth

The heart of Drowa. Every project has a `context.md`, which is **both the AI's memory and our working reference**.

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

**What the MD solves:**
- AI remembers the project even after you leave and come back (no more wipe)
- No need to feed the entire chat history → **lightweight and fast**
- We can open and edit the MD directly → **humans keep control**

**Context injection strategy (keep it light):**
```
Context sent to AI =
  context.md (summary)         ← always
  + current file code          ← always
  + last N messages (e.g. 6)   ← chat continuity
```
→ MD summary + recent messages instead of the full heavy history. Saves tokens + speed.

---

## 4. Layout

```
┌─────────────────────────────────────────────────────────┐
│  Drowa   [project name]        [version ▾] [Export][Deploy]│
├──────────────┬────────────────────────┬──────────────────┤
│              │                        │                  │
│  Developer   │      LIVE PREVIEW       │   Designer       │
│  AI chat     │      (iframe)          │   AI chat         │
│              │                        │                  │
│  "change the │   [rendered UI]        │  "change this    │
│   button     │   click → property     │   color"         │
│   logic"     │   drag → update pos    │                  │
│              │                        │                  │
├──────────────┴────────────────────────┴──────────────────┤
│  [Property panel]  color picker / font / spacing / position│
│  [context.md editor]  ← expand to edit the MD directly     │
└─────────────────────────────────────────────────────────┘
```

Key: **two AI chats on the sides, preview in the middle, property panel + MD editor at the bottom.**

---

## 5. Feature spec

### 5.1 AI code generation
- Natural language prompt → React/HTML/Tailwind code
- Anthropic Claude API (`claude-sonnet` class)
- Output saved as project files + immediately reflected in preview

### 5.2 Separate chats + shared context
- Independent chat panels for developer / designer
- Both reference the same `context.md` + same codebase
- When one makes a change → MD updates → the other AI is automatically aware

### 5.3 Real-time preview sync
- Broadcast code changes via Supabase Realtime
- When one person edits, the other's preview updates

### 5.4 Visual editor
- **Click → select element → property panel** (color/RGB, font, padding/margin)
- **Drag → update position on drop** (not live; reflected on mouseup, 1–2s lag is fine)
- Property change → reflected in code → preview re-renders

### 5.5 MD context management
- AI auto-updates `context.md` as it works
- We can edit the MD directly inside the platform
- MD changes take effect from the next AI request

### 5.6 Version history
- Snapshots at key points
- Roll back to previous versions
- (MVP: simple snapshots / later: diff view)

### 5.7 Export / deploy
- Export full code (zip)
- One-click deploy via Vercel API (optional)

---

## 6. Tech stack

| Area | Choice | Note |
|---|---|---|
| Framework | Next.js (App Router) | already familiar |
| Hosting | Vercel | subscribed |
| DB / Auth / Realtime | Supabase | subscribed |
| AI | Anthropic Claude API | code-gen quality |
| Preview rendering | sandboxed iframe | security isolation |
| Visual editor | iframe postMessage bridge | capture click/drag events |
| Code editor | Monaco / CodeMirror | direct code editing |

---

## 7. Data model (Supabase)

```
projects
  id, name, owner_id, created_at, updated_at

project_members
  project_id, user_id, role (developer | designer)

files
  id, project_id, path, content, updated_at

context_md
  project_id, content, updated_at      ← single source of truth

messages
  id, project_id, user_id, role (dev_ai | design_ai),
  content, created_at

versions
  id, project_id, snapshot (jsonb), label, created_at
```

---

## 8. Visual editor mechanics (the hard part)

```
Inside the preview iframe:
  click element → postMessage("selected", {elementId, styles})
       ↓
Parent window:
  property panel shows current styles
       ↓
User edits color/font/padding
       ↓
Parent → iframe: postMessage("updateStyle", {elementId, newStyle})
       ↓
Simultaneously → reflected in code (files) → saved to Supabase → synced to partner

Drag:
  mousedown → dragging (visual feedback only)
  mouseup → read final coords → reflect position/margin in code
```

**MVP scope:** property editing (color/font/spacing) + position reflected after drag.
**Excluded:** real-time concurrent editing (CRDT), live drag tracking.

---

## 9. Build phases

### Phase 1 — core we can use right away (2 weeks)
- [ ] Supabase project + auth (2 users)
- [ ] Project creation / file storage structure
- [ ] Separate developer/designer chat UI
- [ ] Claude API integration (natural language → code)
- [ ] iframe preview
- [ ] `context.md` auto-generation + context injection

### Phase 2 — workflow completion (2–3 weeks)
- [ ] Click → property panel editing
- [ ] Drag → position update
- [ ] MD editor (direct editing inside the platform)
- [ ] Real-time preview sync (Supabase Realtime)

### Phase 3 — polish & sales-ready (later)
- [ ] Version history / rollback
- [ ] Export (zip)
- [ ] Vercel API deploy
- [ ] Multi-project / external user onboarding

---

## 10. Deliberately NOT building (scope protection)

- ❌ Real-time concurrent editing (CRDT) — unnecessary for 2 people, locks are enough
- ❌ Framer/Webflow-level free-form layout dragging
- ❌ Complex permission system
- ❌ Payments / team features from day one

→ **Prevents the "spent 3 months building everything, can't use anything" scenario.**
