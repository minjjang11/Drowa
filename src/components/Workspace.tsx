"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Preview, type PreviewHandle } from "./Preview";
import { EsbuildPreview } from "./EsbuildPreview";
import { WebContainerPreview } from "./WebContainerPreview";
import { AgentActivityStrip } from "./AgentActivityStrip";
import { PropertyPanel } from "./PropertyPanel";
import { CodePanel } from "./CodePanel";
import { extractJsxBlock, insertAfterBlock, removeBlock } from "@/lib/jsxTransform";
import { relativeTime } from "@/lib/versionMeta";
import { bundleProject } from "@/lib/bundler";
import { buildStandaloneHtml } from "@/lib/standalone";
import { decidePreviewRuntime } from "@/lib/previewRuntime";
import {
  buildAgentPlan,
  DEFAULT_AGENT_TEAM,
  type AgentActivity,
  type AgentProvider,
  type AgentRole,
  type AgentStatus,
} from "@/lib/agents";
import { useI18n } from "@/lib/i18n";
import { BlurText } from "./BlurText";
import { DiffEditor } from "@monaco-editor/react";

const VersionHistoryPanel = dynamic(() => import("./VersionHistoryPanel").then((m) => m.VersionHistoryPanel), { ssr: false });
const DiffModal = dynamic(() => import("./DiffModal").then((m) => m.DiffModal), { ssr: false });
import { ChatPanel, type ChatMessage } from "./ChatPanel";
import { Toolbar } from "./Toolbar";
import { FileTree } from "./FileTree";
import { ContextEditor } from "./ContextEditor";
import dynamic from "next/dynamic";

// Lazy-loaded heavy panels — JS only fetched when the user opens them.
const DesignSystemPanel = dynamic(() => import("./DesignSystemPanel").then((m) => m.DesignSystemPanel), { ssr: false });
const TemplateLibrary = dynamic(() => import("./TemplateLibrary").then((m) => m.TemplateLibrary), { ssr: false });
const InspirationLibrary = dynamic(() => import("./InspirationLibrary").then((m) => m.InspirationLibrary), { ssr: false });
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
  MemberRole,
  Overrides,
  Selection,
  Status,
  StyleMap,
  VersionRow,
  VersionSnapshot,
  VersionTrigger,
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

const AGENT_META: Record<AgentProvider, { id: string; name: string; role: AgentRole }> = {
  claude: { id: "claude-builder", name: "Claude", role: "builder" },
  gpt: { id: "gpt-qa", name: "GPT", role: "qa" },
  gemini: { id: "gemini-ux", name: "Gemini", role: "ux" },
  kimi: { id: "kimi-codebase", name: "Kimi", role: "codebase" },
};

function activityFromRun(row: {
  model?: string;
  role?: string;
  status?: string;
  output_ref?: string | null;
}): AgentActivity | null {
  const provider = row.model as AgentProvider;
  const meta = AGENT_META[provider];
  if (!meta) return null;
  return {
    id: meta.id,
    name: meta.name,
    provider,
    role: (row.role as AgentRole) ?? meta.role,
    status: (row.status as AgentStatus) ?? "idle",
    detail: row.output_ref || "working",
  };
}

export function Workspace({
  projectId,
  projectName,
  initialCode,
  initialFiles,
  initialOverrides,
  initialContextMd,
  initialContextUpdatedAt,
  initialTokens,
  initialGithubLinked,
  initialDev,
  initialDesign,
  initialPrompt,
  myRole,
}: {
  projectId: string;
  projectName: string;
  initialCode: string;
  /** All project code files (incl. App.tsx, excl. overrides) — for the bundler. */
  initialFiles: { path: string; content: string }[];
  initialOverrides: Overrides;
  initialContextMd: string;
  initialContextUpdatedAt: string | null;
  initialTokens: DesignTokens;
  initialGithubLinked: boolean;
  initialDev: ChatMessage[];
  initialDesign: ChatMessage[];
  /** Home "Start from Scratch" seed — fired once at the Developer AI on mount. */
  initialPrompt?: string | null;
  /** Current user's project role — pre-opens their chat drawer. */
  myRole?: MemberRole;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [code, setCode] = useState(initialCode);
  // Dependency files (everything but the editable App.tsx entry) for bundling.
  const depFiles = useMemo(
    () => initialFiles.filter((f) => f.path !== "App.tsx"),
    [initialFiles],
  );
  // Debounce the entry 300ms so the preview doesn't re-bundle on every keystroke.
  const [debouncedCode, setDebouncedCode] = useState(initialCode);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedCode(code), 300);
    return () => clearTimeout(id);
  }, [code]);
  // The self-contained bundle the iframe renders — inlines local imports.
  const projectFiles = useMemo(
    () => [...depFiles, { path: "App.tsx", content: debouncedCode }],
    [depFiles, debouncedCode],
  );
  const previewBundle = useMemo(() => bundleProject(projectFiles), [projectFiles]);
  const hasContent = code.trim() !== "";
  const [overrides, setOverrides] = useState<Overrides>(initialOverrides);
  const [contextMd, setContextMd] = useState(initialContextMd);
  const [contextUpdatedAt, setContextUpdatedAt] = useState(initialContextUpdatedAt);
  const [tokens, setTokens] = useState<DesignTokens>(initialTokens);
  const [designSysOpen, setDesignPanelOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [inspOpen, setInspOpen] = useState(false);
  const [refineHints, setRefineHints] = useState<string[] | null>(null);
  const [designPrefill, setDesignPrefill] = useState<{ text: string; n: number }>({ text: "", n: 0 });
  const [devPrefill, setDevPrefill] = useState<{ text: string; n: number }>({ text: "", n: 0 });
  const [customActions, setCustomActions] = useState<QuickAction[]>([]);
  const [previewError, setPreviewError] = useState<{ message: string; stack?: string } | null>(null);
  // P1 auto-fix: proposed fix awaiting the user's diff approval + attempt counter.
  const [pendingFix, setPendingFix] = useState<{ proposed: string; reply: string } | null>(null);
  const fixAttempts = useRef(0);
  const [deployOpen, setDeployOpen] = useState(false);
  const [lastRole, setLastRole] = useState<AiRole>("dev_ai");
  const [ghDirty, setGhDirty] = useState(false);
  const [ghBusy, setGhBusy] = useState(false);
  const [conflicts, setConflicts] = useState<{ mode: "push" | "pull"; paths: string[] } | null>(null);
  const [viewFile, setViewFile] = useState<{ path: string; content: string } | null>(null);
  // ── Phase 3-8: version history ──
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versionsRefresh, setVersionsRefresh] = useState(0);
  const [saveVersionOpen, setSaveVersionOpen] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");
  const [previewVersion, setPreviewVersion] = useState<{ v: VersionRow; snapshot: VersionSnapshot } | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<VersionRow | null>(null);
  const [diffTarget, setDiffTarget] = useState<{ v: VersionRow; snapshot: VersionSnapshot } | null>(null);
  const activePreviewFiles = useMemo(
    () => (previewVersion ? previewVersion.snapshot.files : projectFiles),
    [previewVersion, projectFiles],
  );
  const activePreviewRuntime = useMemo(
    () => decidePreviewRuntime(activePreviewFiles),
    [activePreviewFiles],
  );
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dev, setDev] = useState<ChatMessage[]>(initialDev);
  const [design, setDesign] = useState<ChatMessage[]>(initialDesign);
  const [busy, setBusy] = useState<AiRole | null>(null);
  const [status, setStatus] = useState<Status>("ready");
  const [agentActivities, setAgentActivities] = useState<AgentActivity[]>(DEFAULT_AGENT_TEAM);

  const [editMode, setEditMode] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);

  const [devOpen, setDevOpen] = useState(myRole !== "designer");
  const [designOpen, setDesignOpen] = useState(myRole !== "developer");
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [primaryPrompt, setPrimaryPrompt] = useState("");

  const previewRef = useRef<PreviewHandle>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeEditTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flashStatus(s: Status) {
    setStatus(s);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    if (s === "saved") {
      statusTimer.current = setTimeout(() => setStatus("ready"), 1500);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }

  // ── Phase 3-8: version history ───────────────────────────────────
  // Fire-and-wait snapshot of the whole project (server reads files + context).
  async function snapshotVersion(label: string | null, trigger: VersionTrigger) {
    await fetch("/api/versions/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, label, trigger }),
    });
  }

  async function saveVersion() {
    const label = versionLabel.trim();
    setSaveVersionOpen(false);
    setVersionLabel("");
    await snapshotVersion(label || null, "manual");
    setVersionsRefresh((n) => n + 1);
    showToast("Version saved");
  }

  async function doRestore(v: VersionRow) {
    setRestoreTarget(null);
    setPreviewVersion(null);
    setStatus("generating");
    const res = await fetch("/api/versions/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, versionId: v.id }),
    });
    if (!res.ok) {
      flashStatus("error");
      return;
    }
    showToast(`Restored to ${v.label}`);
    setVersionsRefresh((n) => n + 1);
    // Reload to reflect every restored file + context.
    router.refresh();
    if (typeof window !== "undefined") window.location.reload();
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

  // P3 — reliable live sync: websocket + catch-up on (re)connect + 10s poll
  // fallback. lastFilesSync tracks the newest files.updated_at we've applied so
  // the poll never reverts our own in-flight edits.
  const lastFilesSync = useRef<string>("");
  useEffect(() => {
    const supabase = createClient();

    // Pull the latest App.tsx / overrides straight from the DB (catch-up).
    async function catchUp() {
      const { data } = await supabase
        .from("files")
        .select("path, content, updated_at")
        .eq("project_id", projectId);
      for (const row of (data as { path: string; content: string; updated_at: string }[] | null) ?? []) {
        if (row.path === "App.tsx") {
          if (row.updated_at > lastFilesSync.current) {
            lastFilesSync.current = row.updated_at;
            setCode(row.content);
          }
        } else if (row.path === OVERRIDES_PATH) {
          try {
            setOverrides(JSON.parse(row.content || "{}"));
          } catch {
            /* ignore */
          }
        }
      }
    }

    const channel = supabase
      .channel(`files:${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "files", filter: `project_id=eq.${projectId}` },
        (payload) => {
          const row = payload.new as { path: string; content: string; updated_at?: string };
          if (row?.path === "App.tsx") {
            if (row.updated_at) lastFilesSync.current = row.updated_at;
            setCode(row.content);
          } else if (row?.path === OVERRIDES_PATH) {
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_runs", filter: `project_id=eq.${projectId}` },
        (payload) => {
          const next = activityFromRun(
            payload.new as {
              model?: string;
              role?: string;
              status?: string;
              output_ref?: string | null;
            },
          );
          if (!next) return;
          setAgentActivities((prev) => {
            const idx = prev.findIndex((agent) => agent.provider === next.provider);
            if (idx < 0) return [...prev, next];
            const copy = [...prev];
            copy[idx] = next;
            return copy;
          });
        },
      )
      .subscribe((status) => {
        // On every (re)connect, reconcile against the DB so nothing is missed.
        if (status === "SUBSCRIBED") catchUp();
      });

    // Polling fallback in case the websocket silently drops.
    const poll = setInterval(catchUp, 10000);

    return () => {
      clearInterval(poll);
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

  // ── Phase 3-7: Visual ↔ Code linking ─────────────────────────────
  // Persist App.tsx (after a source-level element op) + mark dirty for GitHub.
  async function persistApp(next: string) {
    setCode(next);
    setGhDirty(true);
    const supabase = createClient();
    const { error } = await supabase.from("files").upsert(
      { project_id: projectId, path: "App.tsx", content: next },
      { onConflict: "project_id,path" },
    );
    flashStatus(error ? "error" : "saved");
  }

  // Manual Monaco-style edit in the code panel: debounced autosave + live re-render.
  function handleCodeEdit(next: string) {
    setCode(next);
    setGhDirty(true);
    if (codeEditTimer.current) clearTimeout(codeEditTimer.current);
    codeEditTimer.current = setTimeout(async () => {
      const supabase = createClient();
      const { error } = await supabase.from("files").upsert(
        { project_id: projectId, path: "App.tsx", content: next },
        { onConflict: "project_id,path" },
      );
      flashStatus(error ? "error" : "saved");
    }, 500);
  }

  // §3 Duplicate — clone the selected element's JSX block in place.
  function duplicateElement() {
    if (!selection?.line) return;
    const block = extractJsxBlock(code, selection.line);
    if (!block) return;
    persistApp(insertAfterBlock(code, block, block.block));
  }

  // §3 Delete — remove the element from source + log it to context.md.
  async function deleteElement() {
    if (!selection?.line) return;
    const block = extractJsxBlock(code, selection.line);
    if (!block) return;
    const next = removeBlock(code, block);
    const deleted = selection;
    setSelection(null);
    previewRef.current?.clearSelection();
    setCode(next);
    setGhDirty(true);

    const supabase = createClient();
    const stamp = new Date().toISOString();
    const nextMd = `${contextMd.trim()}\n\n## ${stamp} — Element deleted: ${deleted.tag} line ${deleted.line}`;
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

  // §3 Add similar — AI clones the element into a new, on-system variant.
  async function addSimilarElement() {
    if (!selection?.line) return;
    const block = extractJsxBlock(code, selection.line);
    if (!block) return;
    setStatus("generating");
    try {
      const res = await fetch("/api/element/similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, block: block.block }),
      });
      const data = await res.json();
      if (!res.ok || !data.code) {
        flashStatus("error");
        return;
      }
      persistApp(insertAfterBlock(code, block, data.code));
    } catch {
      flashStatus("error");
    }
  }

  // §3 Edit — focus the Developer chat with element context pre-filled.
  function editElement() {
    if (!selection) return;
    const s = selection.styles;
    const parts: string[] = [];
    if (s.color) parts.push(`color ${s.color}`);
    if (s.fontSize) parts.push(`font ${s.fontSize}`);
    if (s.fontFamily) parts.push(`family ${s.fontFamily.split(",")[0].replace(/["']/g, "")}`);
    if (s.paddingTop) parts.push(`padding ${s.paddingTop}`);
    if (s.marginTop) parts.push(`margin ${s.marginTop}`);
    const text = `Edit the ${selection.tag} element on line ${selection.line}:\nCurrent styles: ${parts.join(", ") || "n/a"}\n`;
    setDevPrefill((p) => ({ text, n: p.n + 1 }));
    setDevOpen(true);
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

  // Home "Start from Scratch": fire the seed prompt at the Developer AI once.
  const seedFired = useRef(false);
  useEffect(() => {
    if (seedFired.current || !initialPrompt) return;
    seedFired.current = true;
    send("dev_ai", initialPrompt);
    router.replace(`/project/${projectId}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

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
    // 3-8: snapshot pre-insert state.
    await snapshotVersion(null, "template_insert");
    setVersionsRefresh((n) => n + 1);

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
    await snapshotVersion(null, "github_sync");
    setVersionsRefresh((n) => n + 1);
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
    await snapshotVersion(null, "github_sync");
    setVersionsRefresh((n) => n + 1);
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

  // P2 — real deploy: download a self-contained, ready-to-host index.html.
  function deploy() {
    const html = buildStandaloneHtml(previewBundle, projectName);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "index.html";
    a.click();
    URL.revokeObjectURL(url);
    setDeployOpen(true);
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
    setAgentActivities(buildAgentPlan(role, prompt).activities);
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
      if (Array.isArray(data.agents)) setAgentActivities(data.agents);
      if (data.code) {
        setCode(data.code);
        setGhDirty(true);
        setVersionsRefresh((n) => n + 1); // server snapshotted pre-change state
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

  // P1 Safe auto-fix: ask the AI for a fix, but PREVIEW it as a diff first —
  // never overwrite the user's work blindly. Stops after 2 failed attempts.
  async function fixError() {
    if (!previewError) return;
    if (fixAttempts.current >= 2) {
      const append = lastRole === "dev_ai" ? setDev : setDesign;
      append((prev) => [
        ...prev,
        { sender: "ai", content: "Auto-fix couldn't resolve this. Describe the issue to me and I'll fix it directly." },
      ]);
      return;
    }
    const role = lastRole;
    const fixPrompt = `The following error occurred when rendering the UI:
${previewError.message}
${(previewError.stack ?? "").slice(0, 600)}

Fix ONLY this error. Change nothing else — keep all existing functionality and visual design exactly. Return the complete corrected file in one \`\`\`tsx block. Code only.`;

    setBusy(role);
    setStatus("generating");
    setAgentActivities(buildAgentPlan(role, fixPrompt).activities);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // dryRun: get a proposal without touching the DB until the user approves.
        body: JSON.stringify({ projectId, role, prompt: fixPrompt, trigger: "auto_fix", dryRun: true }),
      });
      const data = await res.json();
      if (Array.isArray(data.agents)) setAgentActivities(data.agents);
      if (res.ok && data.code && !data.invalid) {
        setPendingFix({ proposed: data.code, reply: data.reply ?? "" });
      } else {
        fixAttempts.current += 1;
        const append = role === "dev_ai" ? setDev : setDesign;
        append((prev) => [
          ...prev,
          {
            sender: "ai",
            content:
              fixAttempts.current >= 2
                ? "Auto-fix couldn't resolve this. Describe the issue to me and I'll fix it directly."
                : "That fix didn't look valid — try again, or describe the issue.",
          },
        ]);
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setBusy(null);
    }
  }

  // Apply a previewed fix after the user confirms the diff.
  async function applyFix() {
    const fix = pendingFix;
    if (!fix) return;
    setPendingFix(null);
    fixAttempts.current = 0;
    const append = lastRole === "dev_ai" ? setDev : setDesign;

    await snapshotVersion(null, "auto_fix"); // safety net before applying
    setCode(fix.proposed);
    setGhDirty(true);
    setVersionsRefresh((n) => n + 1);
    setPreviewError(null);
    append((prev) => [...prev, { sender: "ai", content: fix.reply || "Applied the fix." }]);

    const supabase = createClient();
    const stamp = new Date().toISOString();
    await supabase.from("files").upsert(
      { project_id: projectId, path: "App.tsx", content: fix.proposed },
      { onConflict: "project_id,path" },
    );
    const short = (previewError?.message ?? "").slice(0, 120);
    const nextMd = `${contextMd.trim()}\n\n## ${stamp} — Auto-fix applied\nError: ${short}\nResolution: user-approved AI fix`;
    setContextMd(nextMd);
    setContextUpdatedAt(stamp);
    await supabase.from("context_md").update({ content: nextMd }).eq("project_id", projectId);
    flashStatus("saved");
  }

  function submitPrimaryPrompt(e: React.FormEvent) {
    e.preventDefault();
    const prompt = primaryPrompt.trim();
    if (!prompt || busy) return;
    setPrimaryPrompt("");
    setDevOpen(true);
    send("dev_ai", prompt);
  }

  const showAgentStrip =
    hasContent &&
    (busy !== null ||
      status === "generating" ||
      agentActivities.some((agent) => agent.status === "active" || agent.status === "failed" || agent.status === "fallback"));

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
    <div className="relative flex h-screen flex-col bg-background">
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
        onOpenVersions={() => setVersionsOpen(true)}
        onSaveVersion={() => setSaveVersionOpen(true)}
        github={{ linked: initialGithubLinked, dirty: ghDirty, busy: ghBusy }}
        onSync={syncToGithub}
        onPull={() => pullFromGithub()}
        hasContent={hasContent}
      />

      {/* Step 1 — empty project: nothing but the prompt. */}
      {!hasContent && !previewVersion && (
        <EmptyPrompt
          title={t("emptyPrompt")}
          placeholder={t("promptPlaceholder")}
          busy={busy !== null}
          onSubmit={(p) => send("dev_ai", p)}
        />
      )}

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
                prefill={devPrefill}
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

          {/* §5 Previewing-a-version banner. */}
          {previewVersion && (
            <div className="flex shrink-0 items-center justify-between bg-accent px-3 py-1.5 text-white">
              <span className="font-mono text-[11px]">
                Previewing: <span className="font-semibold">{previewVersion.v.label}</span> — {relativeTime(previewVersion.v.created_at)}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setRestoreTarget(previewVersion.v)}
                  className="rounded-[4px] bg-white px-2.5 py-1 font-mono text-[10px] font-medium text-accent hover:opacity-90"
                >
                  Restore this
                </button>
                <button
                  onClick={() => setPreviewVersion(null)}
                  className="rounded-[4px] px-2.5 py-1 font-mono text-[10px] text-white hover:opacity-70"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {hasContent && !previewVersion && (
            <div className="border-b border-border bg-background px-3 py-2">
              {previewError ? (
                <div className="liquid-glass flex items-center justify-between gap-3 rounded-[8px] px-3 py-2">
                  <div className="min-w-0">
                    <p className="serif text-[16px] italic text-foreground">Preview needs repair</p>
                    <p className="truncate font-mono text-[10px] text-muted">
                      {previewError.message.split("\n")[0].slice(0, 120)}
                    </p>
                  </div>
                  <button
                    onClick={fixError}
                    disabled={busy !== null}
                    className="shrink-0 rounded-[5px] bg-accent px-3 py-1.5 font-mono text-[11px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    Fix automatically
                  </button>
                </div>
              ) : busy !== null || status === "generating" ? (
                <div className="liquid-glass flex items-center gap-2 rounded-[8px] px-3 py-2">
                  <span className="amber-pulse h-1.5 w-1.5 rounded-full bg-accent" />
                  <p className="serif text-[16px] italic text-foreground">AI team is building</p>
                  <span className="font-mono text-[10px] text-muted">Preview will update when the run is ready</span>
                </div>
              ) : initialGithubLinked && ghDirty ? (
                <div className="liquid-glass flex items-center justify-between gap-3 rounded-[8px] px-3 py-2">
                  <div>
                    <p className="serif text-[16px] italic text-foreground">Changes are ready</p>
                    <p className="font-mono text-[10px] text-muted">Sync this project back to GitHub when you are done reviewing.</p>
                  </div>
                  <button
                    onClick={syncToGithub}
                    disabled={ghBusy}
                    className="shrink-0 rounded-[5px] bg-accent px-3 py-1.5 font-mono text-[11px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {ghBusy ? "Syncing..." : "Sync changes"}
                  </button>
                </div>
              ) : (
                <form onSubmit={submitPrimaryPrompt} className="liquid-glass flex items-center gap-2 rounded-[8px] px-2 py-2">
                  <input
                    value={primaryPrompt}
                    onChange={(e) => setPrimaryPrompt(e.target.value)}
                    placeholder="What should we improve next?"
                    className="min-w-0 flex-1 bg-transparent px-2 font-sans text-sm text-foreground outline-none placeholder:text-muted"
                  />
                  <button
                    type="submit"
                    disabled={!primaryPrompt.trim()}
                    className="rounded-[5px] bg-accent px-3 py-1.5 font-mono text-[11px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    Refine
                  </button>
                </form>
              )}
            </div>
          )}

          {showAgentStrip && (
            <AgentActivityStrip
              agents={agentActivities}
              runtime={activePreviewRuntime}
              busy={busy !== null || status === "generating"}
            />
          )}

          <div className="flex-1 overflow-auto bg-highlight p-3">
            {tab === "preview" ? (
              <div
                className={`relative mx-auto h-full overflow-hidden rounded-[6px] transition-[max-width] duration-150 ${
                  previewError ? "border-2 border-error" : "grad-border"
                }`}
                style={{ maxWidth: DEVICE_WIDTH[device] }}
              >
                {activePreviewRuntime.mode === "webcontainer" ? (
                  <WebContainerPreview
                    files={activePreviewFiles}
                    editMode={editMode && !previewVersion}
                    onError={handlePreviewError}
                  />
                ) : activePreviewRuntime.mode === "esbuild" ? (
                  <EsbuildPreview
                    ref={previewRef}
                    files={activePreviewFiles}
                    entry={activePreviewRuntime.entry}
                    overrides={overrides}
                    editMode={editMode && !previewVersion}
                    onSelect={setSelection}
                    onMove={handleMove}
                    onError={handlePreviewError}
                  />
                ) : (
                  <Preview
                    ref={previewRef}
                    code={previewVersion ? bundleProject(previewVersion.snapshot.files) : previewBundle}
                    overrides={overrides}
                    editMode={editMode && !previewVersion}
                    onSelect={setSelection}
                    onMove={handleMove}
                    onError={handlePreviewError}
                  />
                )}
                <div className="vignette pointer-events-none absolute inset-0 rounded-[6px]" />

                {/* P4 — clean empty state before anything is built. */}
                {!code.trim() && !previewVersion && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-[6px] bg-background text-center">
                    <p className="serif text-2xl italic text-foreground">Nothing here yet</p>
                    <p className="font-mono text-[12px] text-muted">Ask the AI to build something →</p>
                  </div>
                )}

                {/* §3 Floating toolbar — anchored above the selected element. */}
                {editMode && selection?.rect && (
                  <FloatingToolbar
                    rect={selection.rect}
                    onDuplicate={duplicateElement}
                    onEdit={editElement}
                    onDelete={deleteElement}
                    onAddSimilar={addSimilarElement}
                  />
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
                <CodePanel
                  code={viewFile ? viewFile.content : code}
                  activeLine={viewFile ? undefined : selection?.line}
                  editable={!viewFile}
                  onChange={handleCodeEdit}
                />
              </div>
            )}
          </div>

          {editMode && (
            <PropertyPanel
              selection={selection}
              transform={selection ? overrides[selection.id]?.transform : undefined}
              onChange={handleStyleChange}
              onSelectPath={(id) => previewRef.current?.selectById(id)}
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

      {/* §4 Version history panel */}
      {versionsOpen && (
        <VersionHistoryPanel
          projectId={projectId}
          refreshKey={versionsRefresh}
          onClose={() => setVersionsOpen(false)}
          onPreview={(v, snapshot) => {
            setPreviewVersion({ v, snapshot });
            setTab("preview");
          }}
          onRestore={(v) => setRestoreTarget(v)}
          onDiff={(v, snapshot) => setDiffTarget({ v, snapshot })}
          onSaveVersion={() => setSaveVersionOpen(true)}
        />
      )}

      {/* §3 Manual "Save version" modal */}
      {saveVersionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="grad-border w-full max-w-sm rounded-[8px] bg-surface p-5 anim-modal shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
            <h2 className="serif text-lg italic text-foreground">Save version</h2>
            <input
              autoFocus
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveVersion()}
              placeholder="Before major redesign"
              className="input-dark mt-3 w-full rounded-[4px] px-2.5 py-2 font-mono text-[12px]"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setSaveVersionOpen(false);
                  setVersionLabel("");
                }}
                className="rounded-[4px] px-3 py-1.5 font-mono text-[12px] text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={saveVersion}
                className="btn-grad rounded-[4px] px-3 py-1.5 text-sm font-medium text-foreground"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* §6 Restore confirmation */}
      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="grad-border w-full max-w-md rounded-[8px] bg-surface p-6 anim-modal shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
            <h2 className="serif text-lg italic text-foreground">Restore to {restoreTarget.label}?</h2>
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted">
              Your current work will be saved as a version first. This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setRestoreTarget(null)}
                className="rounded-[4px] px-3 py-1.5 font-mono text-[12px] text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => doRestore(restoreTarget)}
                className="rounded-[4px] bg-accent px-3 py-1.5 font-mono text-[12px] font-medium text-white hover:opacity-90"
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* P1 — auto-fix diff confirmation */}
      {pendingFix && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
          <div className="grad-border flex h-[80vh] w-full max-w-5xl flex-col rounded-[8px] bg-surface anim-modal shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
              <span className="serif text-[15px] italic text-foreground">{t("reviewFix")}</span>
              <span className="font-mono text-[11px] text-muted">
                <span className="text-error">current</span> → <span className="text-success">proposed</span>
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <DiffEditor
                theme="vs-dark"
                language="typescript"
                original={code}
                modified={pendingFix.proposed}
                options={{ readOnly: true, renderSideBySide: true, minimap: { enabled: false }, fontSize: 12, scrollBeyondLastLine: false }}
              />
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-border px-3 py-2">
              <button
                onClick={() => setPendingFix(null)}
                className="rounded-[4px] px-3 py-1.5 font-mono text-[12px] text-muted hover:text-foreground"
              >
                {t("cancel")}
              </button>
              <button
                onClick={applyFix}
                className="rounded-[4px] bg-accent px-3 py-1.5 font-mono text-[12px] font-medium text-white hover:opacity-90"
              >
                {t("apply")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* P2 — deploy instructions */}
      {deployOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="grad-border w-full max-w-md rounded-[8px] bg-surface p-6 anim-modal shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
            <h2 className="serif text-lg italic text-foreground">Your site is ready 🎉</h2>
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted">
              Downloaded <span className="text-accent">index.html</span> — a complete, self-contained site. To put it online with a public URL:
            </p>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 font-mono text-[11px] text-foreground">
              <li>Open <a href="https://app.netlify.com/drop" target="_blank" rel="noreferrer" className="text-accent underline">app.netlify.com/drop</a></li>
              <li>Drag <span className="text-accent">index.html</span> onto the page</li>
              <li>Get your live <span className="text-accent">https://…netlify.app</span> URL instantly</li>
            </ol>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setDeployOpen(false)}
                className="btn-grad rounded-[4px] px-3 py-1.5 text-sm font-medium text-foreground"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* §7 Diff modal */}
      {diffTarget && (
        <DiffModal
          projectId={projectId}
          version={diffTarget.v}
          snapshot={diffTarget.snapshot}
          onClose={() => setDiffTarget(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-[6px] border border-border bg-surface-elevated px-4 py-2 font-mono text-[12px] text-foreground shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
          {toast}
        </div>
      )}

      {conflicts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-[8px] border-2 border-error bg-surface p-6 anim-modal shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
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

// Step 1 — full-screen prompt overlay shown until the project has content.
function EmptyPrompt({
  title,
  placeholder,
  busy,
  onSubmit,
}: {
  title: string;
  placeholder: string;
  busy: boolean;
  onSubmit: (prompt: string) => void;
}) {
  const [value, setValue] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!v || busy) return;
    onSubmit(v);
    setValue("");
  }
  return (
    <div className="absolute inset-x-0 bottom-0 top-11 z-30 flex flex-col items-center justify-center gap-6 bg-background px-4">
      <p className="serif text-3xl text-foreground">
        <BlurText text={title} />
      </p>
      <form onSubmit={submit} className="grad-border glow-hover relative w-full max-w-[640px] rounded-[12px] bg-surface">
        <input
          autoFocus
          value={value}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-[12px] bg-transparent px-4 py-4 pr-14 font-sans text-sm text-foreground outline-none placeholder:text-muted disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy}
          aria-label="Generate"
          className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[8px] bg-accent text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "…" : "→"}
        </button>
      </form>
    </div>
  );
}

// §3 — toolbar that floats above the selected element in the preview.
function FloatingToolbar({
  rect,
  onDuplicate,
  onEdit,
  onDelete,
  onAddSimilar,
}: {
  rect: { top: number; left: number; width: number; height: number };
  onDuplicate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddSimilar: () => void;
}) {
  // 8px above the element, centered. Flip below if there's no room up top.
  const above = rect.top > 36;
  const top = above ? rect.top - 8 : rect.top + rect.height + 8;
  const btn =
    "rounded-[4px] px-1.5 py-1 font-sans text-[11px] text-muted transition-colors hover:text-accent";
  return (
    <div
      className="absolute z-20"
      style={{
        left: rect.left + rect.width / 2,
        top,
        transform: above ? "translate(-50%, -100%)" : "translate(-50%, 0)",
      }}
    >
      <div className="liquid-glass flex items-center gap-0.5 rounded-[8px] px-1 py-0.5">
        <button onClick={onDuplicate} className={btn} title="Duplicate">⎘ Duplicate</button>
        <button onClick={onEdit} className={btn} title="Edit in chat">✎ Edit</button>
        <button onClick={onDelete} className={`${btn} hover:text-error`} title="Delete">✕ Delete</button>
        <button onClick={onAddSimilar} className={btn} title="AI: add similar">+ Add similar</button>
      </div>
    </div>
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
