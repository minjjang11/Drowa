# Preview Runtime — Investigation, Findings & Cloud-Sandbox Direction

**Date:** 2026-06-07
**Status:** Investigation complete; Plan B (cloud sandbox) design in progress (brainstorming, no implementation yet)
**Area:** `src/components/WebContainerPreview.tsx`, `src/lib/previewRuntime.ts`, `src/components/Workspace.tsx`

---

## 1. Goal

drowa should preview imported full-stack apps the way Readdy / Replit / Manus / Bolt / Lovable do —
i.e. a real running app, including Next.js + Supabase auth (server `cookies()`), not just a flattened
single component.

## 2. Symptom timeline

1. **Build error** (production `next build` in WebContainer): `cookies` was called outside a request scope
   during prerender of `/find`, `/pair`, `/today`, … — the whole preview build failed.
2. After switching to `next dev`: the **runtime overlay** `Error: cookies was called outside a request scope`
   (`next-dynamic-api-wrong-context`), source `lib/supabase/server.ts:11` @ `cookies`.
   Call stack: `createClient (app/page.tsx:29)` → … → `Array.toJSON` → `Timeout.eval`.

## 3. How competitors do preview (research)

| Product | Preview engine | Mode |
|---|---|---|
| Bolt.new / StackBlitz | Browser **WebContainer** | dev server (Vite / `next dev`) + HMR |
| Lovable | **Remote cloud sandbox** | live container, native Supabase, deploy to URL |
| v0 | Component sandbox | render + deploy to Vercel |
| Replit | **Cloud VM** (Nix) | full real code execution |
| Manus / Readdy | **Cloud agent sandbox** | real Linux container |

**Rule every one of them follows:** preview = dev server or a real cloud container.
**None run a production `next build` for the live preview.**

## 4. What was tried (in order) and the result

| Step | Change | Commit | Result |
|---|---|---|---|
| A | Production `next build` + `start` in WebContainer | `83cb9bf` | build-time prerender crash on cookies pages |
| B | Inject `export const dynamic="force-dynamic"` into routes | `28a841e`, `a81fc72` | wrong layer; also broke `"use client"` ordering (fixed in a81fc72) |
| C | Switch all stacks to their **dev server** (`next dev -H 0.0.0.0`), remove injection | `52bd918` | killed the *build* crash; runtime cookies overlay remained |
| D | Re-add directive-safe force-dynamic injection alongside `next dev` | `5f04dcb` | **did not fix** the runtime overlay |
| E | **Revert D** (injection is dead weight; also build-breaks Next 16 `cacheComponents` apps) | `97dbd78` | current state: `next dev`, no injection |

Current production state = `next dev` for every stack, no force-dynamic injection.

## 5. Root-cause investigation (evidence)

The failing app was identified (read-only DB read, user-approved) as **`pacemaker`**:
**Next 14.2.35 + React 18**, `next.config.mjs` only sets `serverActions.bodySizeLimit` (no `ppr` /
`cacheComponents`). `app/page.tsx:29` = `const supabase = await createClient();` — a **clean, directly
awaited** server `cookies()` call. `pacemaker` also exists locally at `C:\Users\User\pacemaker`.

Reproductions under `next dev` on **real Node**:

| Test | Result |
|---|---|
| Minimal Next page, direct `await cookies()`, Next 15.5.4 | HTTP 200, no error |
| Same, Next 16.2.7 | HTTP 200, no error |
| Exact pacemaker page logic (searchParams + redirect + cookies), Next 15 & 16 | HTTP 200 (only benign "await searchParams" warning) |
| Next 16 `cacheComponents` + `export const dynamic` | build error: "Route segment config dynamic is not compatible with cacheComponents" |
| **The actual pacemaker repo, exact Next 14.2.35, real Node `next dev`** | **HTTP 200, real "Pacemaker" landing rendered, ZERO cookies error** |
| drowa **WebContainer** (deployed `5f04dcb`), fresh boot | **cookies was called outside a request scope** |

## 6. Conclusion — the WebContainer wall

The `cookies was called outside a request scope` error occurs **only inside drowa's browser
WebContainer**, never on real Node (verified for the exact app + Next 14, and for Next 15/16).

**Root cause:** WebContainer's emulated Node does not maintain the request-scoped `AsyncLocalStorage`
through the deferred RSC render (`Array.toJSON` + `Timeout.eval` path). `cookies()` reads that store →
throws. The `force-dynamic`/prerender theories were red herrings (confirmed: the app prerenders fine on
real Node; `cacheComponents` doesn't exist in Next 14).

**There is no code/config/version fix** — nothing is wrong with the imported app; it runs correctly on
real Node and would deploy fine to Vercel. Browser WebContainer simply cannot host an SSR app that reads
auth cookies. This is the documented reason Lovable / Replit / Manus run **real cloud containers**.

The dev-server path is **exhausted and proven exhausted.**

## 7. What still works on WebContainer / current preview

- Static / single-file / multi-file front-end previews (`iframe`, `esbuild` runtimes) — unaffected.
- Vite/React imports under `next dev`/`vite` — verified booting + HMR on real Node.
- `next dev` change kept: removes the build-time prerender crash, gives HMR, and isolates one broken
  page from killing the whole preview.

## 8. Plan B — direction (agreed; design not yet finalized)

Replace the browser WebContainer with a **real cloud sandbox (real Node)** for full-stack server apps.
Slots into `decidePreviewRuntime` as a new runtime mode (the `hasServerRuntime` branch currently → 
`"webcontainer"` would route to the new sandbox mode instead), surfaced in `Workspace` like
`WebContainerPreview` is today.

### Open questions to resolve in design
1. **Scope first:** validation spike (one app, end-to-end, prove cost/latency) vs. full multi-tenant
   production feature.
2. **Provider:** E2B / Fly Machines / Vercel Sandbox / Daytona / Modal — trade-offs on boot latency,
   cost, Node fidelity, networking, teardown.
3. **File + env sync:** how mounted project files (`files` table) and `preview_env` (public keys) reach
   the sandbox; how edits/HMR propagate.
4. **Preview surfacing:** sandbox URL in an iframe vs. proxied through drowa.
5. **Lifecycle & cost:** when sandboxes boot/sleep/teardown; concurrency; per-user metering; idle reaping.
6. **Integration:** new `PreviewRuntimeMode` value; keep WebContainer/esbuild/iframe for non-server apps;
   fallback path; reuse of existing `previewEnv` validation and `onQuickPreview`.

### Constraints / preferences captured
- User wants to **fix dev-server path before Plan B** — now satisfied (proven exhausted).
- Do **not** start Plan B implementation without explicit go-ahead (brainstorming/design first).

## 9. Relevant commits
```
97dbd78 Revert "fix: re-add force-dynamic injection for next dev previews"   <- current
5f04dcb fix: re-add force-dynamic injection for next dev previews            (reverted)
52bd918 refactor: run imported Next apps via next dev, not production build  <- the keeper change
a81fc72 fix: insert force-dynamic after use client directive
28a841e fix: force imported Next apps dynamic in WebContainer preview
83cb9bf fix: run Next apps in production mode in the WebContainer preview
```
