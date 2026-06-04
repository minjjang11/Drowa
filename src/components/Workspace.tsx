"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  initialDev: ChatMessage[];
  initialDesign: ChatMessage[];
}) {
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

  async function send(role: AiRole, prompt: string, image?: string) {
    const append = role === "dev_ai" ? setDev : setDesign;
    append((prev) => [...prev, { sender: "user", content: image ? `🖼️ ${prompt}` : prompt }]);
    setBusy(role);
    setStatus("generating");
    setRefineHints(null);
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
      if (data.code) setCode(data.code);
      flashStatus("saved");
    } catch {
      append((prev) => [...prev, { sender: "ai", content: "⚠️ Network error" }]);
      flashStatus("error");
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
      />

      <div className="flex flex-1 overflow-hidden">
        <FileTree onSaveTemplate={handleSaveTemplate} />

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
                className="grad-border relative mx-auto h-full overflow-hidden rounded-[6px] transition-[max-width] duration-150"
                style={{ maxWidth: DEVICE_WIDTH[device] }}
              >
                <Preview
                  ref={previewRef}
                  code={code}
                  overrides={overrides}
                  editMode={editMode}
                  onSelect={setSelection}
                  onMove={handleMove}
                />
                <div className="vignette pointer-events-none absolute inset-0 rounded-[6px]" />
              </div>
            ) : (
              <pre className="h-full overflow-auto rounded-[6px] border border-border bg-surface p-4 font-mono text-[12px] leading-relaxed text-foreground">
                {code}
              </pre>
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
