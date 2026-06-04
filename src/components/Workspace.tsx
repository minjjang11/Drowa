"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Preview, type PreviewHandle } from "./Preview";
import { PropertyPanel } from "./PropertyPanel";
import { ChatPanel, type ChatMessage } from "./ChatPanel";
import { Toolbar } from "./Toolbar";
import { FileTree } from "./FileTree";
import { ContextEditor } from "./ContextEditor";
import { DesignSystemPanel } from "./DesignSystemPanel";
import { TemplateLibrary } from "./TemplateLibrary";
import { InspirationLibrary } from "./InspirationLibrary";
import {
  insertTemplate,
  toTemplateCode,
  REFINE_PROMPTS,
  type Template,
} from "@/lib/templates";
import {
  buildApplyPrompt,
  MATCH_STYLE_PROMPT,
  type Inspiration,
} from "@/lib/inspirations";
import { BUILTIN_ACTIONS, type QuickAction } from "@/lib/quickActions";
import type {
  AiRole,
  DesignTokens,
  DeviceMode,
  Overrides,
  Selection,
  Status,
  StyleMap,
} from "@/lib/types";

/** Replace or append the ## Design System block in context.md so both AIs always see tokens. */
function syncDesignSection(md: string, tokens: DesignTokens): string {
  const block = `## Design System\n\n\`\`\`json\n${JSON.stringify(tokens, null, 2)}\n\`\`\``;
  const re = /## Design System\n\n```json\n[\s\S]*?\n```/;
  if (re.test(md)) return md.replace(re, block);
  return `${md.trim()}\n\n${block}\n`;
}

const OVERRIDES_PATH = "overrides.json";

const DEVICE_WIDTH: Record<DeviceMode, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

export function Workspace({
  projectId,
  projectName,
  initialCode,
  initialOverrides,
  initialContextMd,
  initialContextUpdatedAt,
  initialTokens,
  initialGithubLinked,
  initialDev,
  initialDesign,
}: {
  projectId: string;
  projectName: string;
  initialCode: string;
  initialOverrides: Overrides;
  initialContextMd: string;
  initialContextUpdatedAt: string | null;
  initialTokens: DesignTokens;
  initialGithubLinked: boolean;
  initialDev: ChatMessage[];
  initialDesign: ChatMessage[];
}) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [overrides, setOverrides] = useState<Overrides>(initialOverrides);
  const [contextMd, setContextMd] = useState(initialContextMd);
  const [contextUpdatedAt, setContextUpdatedAt] = useState(initialContextUpdatedAt);
  const [tokens, setTokens] = useState<DesignTokens>(initialTokens);
  const [designSysOpen, setDesignPanelOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [inspOpen, setInspOpen] = useState(false);
  const [refineHints, setRefineHints] = useState<string[] | null>(null);
  const [designPrefill, setDesignPrefill] = useState<{ text: string; n: number }>({ text: "", n: 0 });
  const [customActions, setCustomActions] = useState<QuickAction[]>([]);
  const [previewError, setPreviewError] = useState<{ message: string; stack?: string } | null>(null);
  const [lastRole, setLastRole] = useState<AiRole>("dev_ai");
  const [ghDirty, setGhDirty] = useState(false);
  const [ghBusy, setGhBusy] = useState(false);
  const [conflicts, setConflicts] = useState<{ mode: "push" | "pull"; paths: string[] } | null>(null);
  const [viewFile, setViewFile] = useState<{ path: string; content: string } | null>(null);
  const tokenSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dev, setDev] = useState<ChatMessage[]>(initialDev);
  const [design, setDesign] = useState<ChatMessage[]>(initialDesign);
  const [busy, setBusy] = useState<AiRole | null>(null);
  const [status, setStatus] = useState<Status>("ready");

  const [editMode, setEditMode] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);

  const [devOpen, setDevOpen] = useState(true);
  const [designOpen, setDesignOpen] = useState(true);
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [tab, setTab] = useState<"preview" | "code">("preview");

  const previewRef = useRef<PreviewHandle>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flashStatus(s: Status) {
    setStatus(s);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    if (s === "saved") {
      statusTimer.current = setTimeout(() => setStatus("ready"), 1500);
    }
  }

  const persistOverrides = useCallback(
    (next: Overrides) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const supabase = createClient();
        const { error } = await supabase.from("files").upsert(
          { project_id: projectId, path: OVERRIDES_PATH, content: JSON.stringify(next) },
          { onConflict: "project_id,path" },
        );
        flashStatus(error ? "error" : "saved");
      }, 600);
    },
    [projectId],
  );

  // Live sync: partner's code + overrides.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`files:${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "files", filter: `project_id=eq.${projectId}` },
        (payload) => {
          const row = payload.new as { path: string; content: string };
          if (row?.path === "App.tsx") setCode(row.content);
          else if (row?.path === OVERRIDES_PATH) {
            try {
              setOverrides(JSON.parse(row.content || "{}"));
            } catch {
              /* ignore */
            }
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "context_md", filter: `project_id=eq.${projectId}` },
        (payload) => {
          const row = payload.new as { content: string; updated_at: string };
          if (typeof row?.content === "string") {
            setContextMd(row.content);
            setContextUpdatedAt(row.updated_at);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "design_tokens", filter: `project_id=eq.${projectId}` },
        (payload) => {
          const row = payload.new as { tokens: DesignTokens };
          if (row?.tokens) setTokens(row.tokens);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  function handleStyleChange(style: StyleMap) {
    if (!selection) return;
    previewRef.current?.applyStyle(selection.id, style);
    setOverrides((prev) => {
      const next = { ...prev, [selection.id]: { ...prev[selection.id], ...style } };
      persistOverrides(next);
      return next;
    });
    setSelection((prev) => (prev ? { ...prev, styles: { ...prev.styles, ...style } } : prev));
  }

  function handleMove(id: string, transform: string) {
    setOverrides((prev) => {
      const next = { ...prev, [id]: { ...prev[id], transform } };
      persistOverrides(next);
      return next;
    });
  }

  function toggleEdit() {
    setEditMode((v) => {
      if (v) {
        setSelection(null);
        previewRef.current?.clearSelection();
      }
      return !v;
    });
  }

  async function saveContext(next: string) {
    setContextMd(next);
    setContextUpdatedAt(new Date().toISOString());
    const supabase = createClient();
    const { error } = await supabase
      .from("context_md")
      .update({ content: next })
      .eq("project_id", projectId);
    flashStatus(error ? "error" : "saved");
  }

  // Load the user's custom quick actions once.
  const loadActions = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("quick_actions")
      .select("id, label, icon, prompt_template, category")
      .eq("is_global", false)
      .order("order_index", { ascending: true });
    if (data) {
      setCustomActions(
        data.map((r) => ({
          id: r.id as string,
          label: r.label as string,
          icon: (r.icon as string) ?? "⭐",
          promptTemplate: r.prompt_template as string,
          category: "custom",
        })),
      );
    }
  }, []);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  async function handleAddQuickAction() {
    const label = window.prompt("Action label? (e.g. Make it playful)");
    if (!label) return;
    const promptTemplate = window.prompt("Prompt sent to the AI when clicked?");
    if (!promptTemplate) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("quick_actions").insert({
      owner_id: user.id,
      label: label.trim(),
      icon: "⭐",
      prompt_template: promptTemplate.trim(),
      category: "custom",
      is_global: false,
    });
    if (!error) {
      flashStatus("saved");
      loadActions();
    } else {
      flashStatus("error");
    }
  }

  const quickActions = [...BUILTIN_ACTIONS, ...customActions];

  // Edit tokens locally; debounce persist to design_tokens + sync into context.md.
  function handleTokensChange(next: DesignTokens) {
    setTokens(next);
    if (tokenSaveTimer.current) clearTimeout(tokenSaveTimer.current);
    tokenSaveTimer.current = setTimeout(async () => {
      const supabase = createClient();
      const nextMd = syncDesignSection(contextMd, next);
      setContextMd(nextMd);
      setContextUpdatedAt(new Date().toISOString());
      const [{ error: e1 }, { error: e2 }] = await Promise.all([
        supabase.from("design_tokens").upsert(
          { project_id: projectId, tokens: next },
          { onConflict: "project_id" },
        ),
        supabase.from("context_md").update({ content: nextMd }).eq("project_id", projectId),
      ]);
      flashStatus(e1 || e2 ? "error" : "saved");
    }, 600);
  }

  // Insert a template: compose into the file, persist, log to context.md, offer refine prompts.
  async function handleInsertTemplate(t: Template) {
    const next = insertTemplate(code, t.code);
    setCode(next);
    setGhDirty(true);
    setTemplatesOpen(false);
    setRefineHints(REFINE_PROMPTS);
    setStatus("generating");

    const supabase = createClient();
    const stamp = new Date().toISOString();
    const nextMd = `${contextMd.trim()}\n\n## ${stamp} — Template inserted: ${t.name}`;
    setContextMd(nextMd);
    setContextUpdatedAt(stamp);
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("files").upsert(
        { project_id: projectId, path: "App.tsx", content: next },
        { onConflict: "project_id,path" },
      ),
      supabase.from("context_md").update({ content: nextMd }).eq("project_id", projectId),
    ]);
    flashStatus(e1 || e2 ? "error" : "saved");
  }

  // Save the current file as a reusable custom template.
  async function handleSaveTemplate() {
    const name = window.prompt("Template name?");
    if (!name) return;
    const category =
      window.prompt("Category? (hero / cards / pricing / forms / nav / dashboard / footer)", "cards") ??
      "cards";
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("templates").insert({
      owner_id: user.id,
      name: name.trim(),
      category: category.trim(),
      code: toTemplateCode(code),
      is_global: false,
    });
    flashStatus(error ? "error" : "saved");
  }

  // ── GitHub sync ──────────────────────────────────────
  async function syncToGithub() {
    const message =
      window.prompt("Commit message?", `Drowa: ${new Date().toISOString()}`) ?? undefined;
    if (message === undefined) return;
    setGhBusy(true);
    setStatus("generating");
    try {
      const res = await fetch("/api/github/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, message }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setConflicts({ mode: "push", paths: data.conflicts ?? [] });
        setStatus("error");
      } else if (!res.ok) {
        flashStatus("error");
      } else {
        setGhDirty(false);
        flashStatus("saved");
      }
    } finally {
      setGhBusy(false);
    }
  }

  async function pullFromGithub(resolve?: "remote" | "local") {
    setGhBusy(true);
    setStatus("generating");
    try {
      const res = await fetch("/api/github/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, resolve }),
      });
      const data = await res.json();
      if (!res.ok) {
        flashStatus("error");
        return;
      }
      if (data.conflicts && data.conflicts.length) {
        setConflicts({ mode: "pull", paths: data.conflicts });
        setStatus("error");
        return;
      }
      setConflicts(null);
      setGhDirty(false);
      flashStatus("saved");
      // Reload to reflect pulled file contents.
      router.refresh();
      if (typeof window !== "undefined") window.location.reload();
    } finally {
      setGhBusy(false);
    }
  }

  function exportCode() {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "App.tsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  function deploy() {
    alert("One-click deploy lands in Phase 3 (Vercel API). For now: Export → push to your own repo.");
  }

  function applyStyle(insp: Inspiration) {
    setInspOpen(false);
    setDesignPrefill((p) => ({ text: buildApplyPrompt(insp), n: p.n + 1 }));
    setDesignOpen(true);
  }

  function matchStyle(dataUrl: string) {
    setInspOpen(false);
    setDesignOpen(true);
    send("design_ai", MATCH_STYLE_PROMPT, dataUrl);
  }

  async function send(role: AiRole, prompt: string, image?: string, displayAs?: string) {
    const append = role === "dev_ai" ? setDev : setDesign;
    append((prev) => [...prev, { sender: "user", content: displayAs ?? (image ? `🖼️ ${prompt}` : prompt) }]);
    setBusy(role);
    setLastRole(role);
    setStatus("generating");
    setRefineHints(null);
    setPreviewError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, role, prompt, image }),
      });
      const data = await res.json();
      if (!res.ok) {
        append((prev) => [...prev, { sender: "ai", content: `⚠️ ${data.error ?? "Request failed"}` }]);
        flashStatus("error");
        return;
      }
      append((prev) => [...prev, { sender: "ai", content: data.reply }]);
      if (data.code) {
        setCode(data.code);
        setGhDirty(true);
      }
      if (data.invalid) {
        setPreviewError({ message: "Generated code failed validation." });
        setStatus("error");
      } else {
        flashStatus("saved");
      }
    } catch {
      append((prev) => [...prev, { sender: "ai", content: "⚠️ Network error" }]);
      flashStatus("error");
    } finally {
      setBusy(null);
    }
  }

  // A render error surfaced from inside the preview iframe.
  const handlePreviewError = useCallback((err: { message: string; stack?: string }) => {
    if (!err.message) return;
    setPreviewError(err);
    setStatus("error");
  }, []);

  // One-click auto-fix: send the error + current code to the AI, apply the result.
  async function fixError() {
    if (!previewError) return;
    const role = lastRole;
    const append = role === "dev_ai" ? setDev : setDesign;
    const fixPrompt = `The following error occurred when rendering the UI:
${previewError.message}
${(previewError.stack ?? "").slice(0, 600)}

Fix the error. Return only the corrected complete code in one \`\`\`tsx block. Do not change any functionality or visual design. Code only.`;

    append((prev) => [...prev, { sender: "user", content: "🔧 Fix this error automatically" }]);
    setBusy(role);
    setStatus("generating");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, role, prompt: fixPrompt }),
      });
      const data = await res.json();
      if (res.ok && data.code && !data.invalid) {
        setCode(data.code);
        setGhDirty(true);
        setPreviewError(null);
        append((prev) => [...prev, { sender: "ai", content: data.reply }]);
        flashStatus("saved");

        const supabase = createClient();
        const stamp = new Date().toISOString();
        const short = previewError.message.slice(0, 120);
        const nextMd = `${contextMd.trim()}\n\n## ${stamp} — Auto-fix applied\nError: ${short}\nResolution: AI-generated fix applied successfully`;
        setContextMd(nextMd);
        setContextUpdatedAt(stamp);
        await supabase.from("context_md").update({ content: nextMd }).eq("project_id", projectId);
      } else {
        append((prev) => [...prev, { sender: "ai", content: data.reply ?? "⚠️ Fix failed" }]);
        setStatus("error");
        setDesignPrefill((p) => ({ text: "Still broken — here's what I want: ", n: p.n + 1 }));
      }
    } catch {
      append((prev) => [...prev, { sender: "ai", content: "⚠️ Network error" }]);
      setStatus("error");
    } finally {
      setBusy(null);
    }
  }

  const tabBtn = (id: "preview" | "code", label: string) => (
    <button
      onClick={() => setTab(id)}
      className={`rounded-[3px] px-2.5 py-1 font-mono text-[11px] transition-colors duration-150 ${
        tab === id ? "bg-surface-elevated text-accent shadow-[0_1px_2px_rgba(0,0,0,0.4)]" : "text-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-screen flex-col bg-background">
      <Toolbar
        projectId={projectId}
        projectName={projectName}
        status={status}
        device={device}
        onDevice={setDevice}
        onExport={exportCode}
        onDeploy={deploy}
        onOpenDesign={() => setDesignPanelOpen(true)}
        onOpenTemplates={() => setTemplatesOpen(true)}
        onOpenInspiration={() => setInspOpen(true)}
        github={{ linked: initialGithubLinked, dirty: ghDirty, busy: ghBusy }}
        onSync={syncToGithub}
        onPull={() => pullFromGithub()}
      />

      <div className="flex flex-1 overflow-hidden">
        <FileTree
          projectId={projectId}
          onOpen={(path, content) => {
            setViewFile({ path, content });
            setTab("code");
          }}
          onSaveTemplate={handleSaveTemplate}
        />

        {/* Developer AI drawer */}
        {devOpen ? (
          <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-surface grad-border">
            <div className="relative flex-1 overflow-hidden">
              <ChatPanel
                role="dev_ai"
                title="Developer AI"
                messages={dev}
                busy={busy === "dev_ai"}
                onSend={(p) => send("dev_ai", p)}
                suggestions={refineHints ?? undefined}
                onSuggestion={(s) => send("dev_ai", s)}
                quickActions={quickActions}
                onQuickAction={(t) => send("dev_ai", t)}
                onAddQuickAction={handleAddQuickAction}
                errorCard={previewError && lastRole === "dev_ai" ? previewError : null}
                onFix={fixError}
              />
            </div>
            <CollapseTab side="left" onClick={() => setDevOpen(false)} />
          </aside>
        ) : (
          <ReopenRail label="DEV" onClick={() => setDevOpen(true)} />
        )}

        {/* Preview hero */}
        <main className="relative flex flex-1 flex-col overflow-hidden bg-background">
          <div className="flex h-9 shrink-0 items-center justify-between border-b border-border bg-surface px-2">
            <div className="flex items-center gap-0.5 rounded-[5px] border border-border bg-background p-0.5">
              {tabBtn("preview", "Preview")}
              {tabBtn("code", "Code")}
            </div>
            <button
              onClick={toggleEdit}
              className={`flex items-center gap-1.5 rounded-[4px] border px-2.5 py-1 font-mono text-[11px] transition-colors duration-150 ${
                editMode ? "border-accent bg-accent text-background" : "border-border bg-surface text-muted hover:text-foreground"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${editMode ? "bg-white" : "bg-muted"}`} />
              {editMode ? "editing" : "edit"}
            </button>
          </div>

          <div className="flex-1 overflow-auto p-3">
            {tab === "preview" ? (
              <div
                className={`relative mx-auto h-full overflow-hidden rounded-[6px] transition-[max-width] duration-150 ${
                  previewError ? "border-2 border-error" : "grad-border"
                }`}
                style={{ maxWidth: DEVICE_WIDTH[device] }}
              >
                <Preview
                  ref={previewRef}
                  code={code}
                  overrides={overrides}
                  editMode={editMode}
                  onSelect={setSelection}
                  onMove={handleMove}
                  onError={handlePreviewError}
                />
                <div className="vignette pointer-events-none absolute inset-0 rounded-[6px]" />

                {previewError && (
                  <div className="absolute inset-x-0 bottom-0 z-10 border-t border-error bg-[#0d0d0d]/95 p-4 backdrop-blur-sm">
                    <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-error">Render error</p>
                    <pre className="mb-3 line-clamp-2 max-h-10 overflow-hidden font-mono text-[11px] leading-snug text-foreground">
                      {previewError.message}
                    </pre>
                    <div className="flex gap-2">
                      <button
                        onClick={fixError}
                        disabled={busy !== null}
                        className="rounded-[4px] bg-accent px-3 py-1.5 font-mono text-[11px] font-medium text-[#0d0d0d] transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        Fix automatically
                      </button>
                      <button
                        onClick={() => {
                          setPreviewError(null);
                          setStatus("ready");
                        }}
                        className="rounded-[4px] px-3 py-1.5 font-mono text-[11px] text-muted transition-colors hover:text-foreground"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-full flex-col overflow-hidden rounded-[6px] border border-border bg-surface">
                {viewFile && (
                  <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                    <span className="font-mono text-[11px] text-accent">{viewFile.path}</span>
                    <button
                      onClick={() => setViewFile(null)}
                      className="font-mono text-[10px] text-muted hover:text-foreground"
                    >
                      show App.tsx ✕
                    </button>
                  </div>
                )}
                <pre className="flex-1 overflow-auto p-4 font-mono text-[12px] leading-relaxed text-foreground">
                  {viewFile ? viewFile.content : code}
                </pre>
              </div>
            )}
          </div>

          {editMode && (
            <PropertyPanel
              selection={selection}
              transform={selection ? overrides[selection.id]?.transform : undefined}
              onChange={handleStyleChange}
            />
          )}
        </main>

        {/* Designer AI drawer */}
        {designOpen ? (
          <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-surface grad-border">
            <div className="relative flex-1 overflow-hidden">
              <ChatPanel
                role="design_ai"
                title="Designer AI"
                messages={design}
                busy={busy === "design_ai"}
                onSend={(p) => send("design_ai", p)}
                suggestions={refineHints ?? undefined}
                onSuggestion={(s) => send("design_ai", s)}
                prefill={designPrefill}
                quickActions={quickActions}
                onQuickAction={(t) => send("design_ai", t)}
                onAddQuickAction={handleAddQuickAction}
                errorCard={previewError && lastRole === "design_ai" ? previewError : null}
                onFix={fixError}
              />
            </div>
            <CollapseTab side="right" onClick={() => setDesignOpen(false)} />
          </aside>
        ) : (
          <ReopenRail label="DESIGN" onClick={() => setDesignOpen(true)} />
        )}
      </div>

      <ContextEditor
        content={contextMd}
        updatedAt={contextUpdatedAt}
        onSave={saveContext}
      />

      {designSysOpen && (
        <DesignSystemPanel
          tokens={tokens}
          onChange={handleTokensChange}
          onClose={() => setDesignPanelOpen(false)}
        />
      )}

      {templatesOpen && (
        <TemplateLibrary
          onInsert={handleInsertTemplate}
          onClose={() => setTemplatesOpen(false)}
        />
      )}

      {inspOpen && (
        <InspirationLibrary
          onApply={applyStyle}
          onMatchStyle={matchStyle}
          onClose={() => setInspOpen(false)}
        />
      )}

      {conflicts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-[8px] border-2 border-error bg-surface p-6 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
            <h2 className="serif text-lg italic text-foreground">Merge conflict</h2>
            <p className="mt-1 font-mono text-[11px] text-muted">
              {conflicts.mode === "push"
                ? "Remote has changes — pull first."
                : "These files changed both locally and on GitHub:"}
            </p>
            <div className="my-3 max-h-40 overflow-y-auto rounded-[4px] border border-border bg-background p-2">
              {conflicts.paths.map((p) => (
                <div key={p} className="font-mono text-[11px] text-error">
                  {p}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              {conflicts.mode === "push" ? (
                <>
                  <button
                    onClick={() => setConflicts(null)}
                    className="rounded-[4px] border border-border bg-surface px-3 py-1.5 font-mono text-[12px] text-muted hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setConflicts(null);
                      pullFromGithub();
                    }}
                    className="btn-grad rounded-[4px] px-3 py-1.5 text-sm font-medium text-foreground"
                  >
                    Pull first
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => pullFromGithub("local")}
                    className="rounded-[4px] border border-border bg-surface px-3 py-1.5 font-mono text-[12px] text-foreground hover:border-accent"
                  >
                    Keep local
                  </button>
                  <button
                    onClick={() => pullFromGithub("remote")}
                    className="btn-grad rounded-[4px] px-3 py-1.5 text-sm font-medium text-foreground"
                  >
                    Take remote
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CollapseTab({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Collapse panel"
      className="flex h-6 shrink-0 items-center justify-center border-t border-border font-mono text-[10px] text-muted hover:bg-background hover:text-foreground"
    >
      {side === "left" ? "‹ collapse" : "collapse ›"}
    </button>
  );
}

function ReopenRail({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={`Open ${label} chat`}
      className="flex w-8 shrink-0 items-center justify-center border-x border-border bg-surface text-muted hover:bg-background hover:text-foreground"
    >
      <span className="font-mono text-[10px] tracking-wider [writing-mode:vertical-rl]">
        {label}
      </span>
    </button>
  );
}
