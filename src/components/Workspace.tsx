"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Preview, type PreviewHandle } from "./Preview";
import { PropertyPanel } from "./PropertyPanel";
import { ChatPanel, type ChatMessage } from "./ChatPanel";
import type { AiRole, Overrides, Selection, StyleMap } from "@/lib/types";

const OVERRIDES_PATH = "overrides.json";

export function Workspace({
  projectId,
  projectName,
  initialCode,
  initialOverrides,
  initialDev,
  initialDesign,
}: {
  projectId: string;
  projectName: string;
  initialCode: string;
  initialOverrides: Overrides;
  initialDev: ChatMessage[];
  initialDesign: ChatMessage[];
}) {
  const [code, setCode] = useState(initialCode);
  const [overrides, setOverrides] = useState<Overrides>(initialOverrides);
  const [dev, setDev] = useState<ChatMessage[]>(initialDev);
  const [design, setDesign] = useState<ChatMessage[]>(initialDesign);
  const [busy, setBusy] = useState<AiRole | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);

  const previewRef = useRef<PreviewHandle>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced persist of overrides → files table (synced to partner via Realtime).
  const persistOverrides = useCallback(
    (next: Overrides) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const supabase = createClient();
        await supabase.from("files").upsert(
          { project_id: projectId, path: OVERRIDES_PATH, content: JSON.stringify(next) },
          { onConflict: "project_id,path" },
        );
      }, 600);
    },
    [projectId],
  );

  // Live sync: partner's code changes + overrides changes.
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
              /* ignore malformed */
            }
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  // Live style edit from the property panel.
  function handleStyleChange(style: StyleMap) {
    if (!selection) return;
    previewRef.current?.applyStyle(selection.id, style);
    setOverrides((prev) => {
      const next = { ...prev, [selection.id]: { ...prev[selection.id], ...style } };
      persistOverrides(next);
      return next;
    });
    setSelection((prev) =>
      prev ? { ...prev, styles: { ...prev.styles, ...style } } : prev,
    );
  }

  // Drag drop → store the committed transform.
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

  async function send(role: AiRole, prompt: string) {
    const append = role === "dev_ai" ? setDev : setDesign;
    append((prev) => [...prev, { sender: "user", content: prompt }]);
    setBusy(role);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, role, prompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        append((prev) => [...prev, { sender: "ai", content: `⚠️ ${data.error ?? "Request failed"}` }]);
        return;
      }
      append((prev) => [...prev, { sender: "ai", content: data.reply }]);
      if (data.code) setCode(data.code);
    } catch {
      append((prev) => [...prev, { sender: "ai", content: "⚠️ Network error" }]);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-11 items-center justify-between border-b border-border bg-surface px-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-mono text-xs text-muted hover:text-foreground">
            ← drowa
          </Link>
          <span className="text-border">/</span>
          <span className="text-sm font-medium">{projectName}</span>
        </div>
        <button
          onClick={toggleEdit}
          className={`flex items-center gap-1.5 rounded-[4px] border px-2.5 py-1 font-mono text-[11px] transition-colors duration-150 ${
            editMode
              ? "border-accent bg-accent text-white"
              : "border-border bg-surface text-muted hover:text-foreground"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${editMode ? "bg-white" : "bg-muted"}`} />
          {editMode ? "editing" : "edit"}
        </button>
      </header>

      <div className="grid flex-1 grid-cols-[300px_1fr_300px] overflow-hidden">
        <aside className="border-r border-border bg-surface">
          <ChatPanel
            role="dev_ai"
            title="Developer AI"
            messages={dev}
            busy={busy === "dev_ai"}
            onSend={(p) => send("dev_ai", p)}
          />
        </aside>

        <main className="flex flex-col overflow-hidden bg-[#f5f5f5]">
          <div className="flex-1 overflow-hidden p-3">
            <div className="h-full w-full overflow-hidden rounded-[4px] border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <Preview
                ref={previewRef}
                code={code}
                overrides={overrides}
                editMode={editMode}
                onSelect={setSelection}
                onMove={handleMove}
              />
            </div>
          </div>

          {editMode && (
            <div className="border-t border-border bg-surface">
              {selection ? (
                <PropertyPanel selection={selection} onChange={handleStyleChange} />
              ) : (
                <p className="px-4 py-3 font-mono text-[11px] text-muted">
                  click an element in the preview to edit it
                </p>
              )}
            </div>
          )}
        </main>

        <aside className="border-l border-border bg-surface">
          <ChatPanel
            role="design_ai"
            title="Designer AI"
            messages={design}
            busy={busy === "design_ai"}
            onSend={(p) => send("design_ai", p)}
          />
        </aside>
      </div>
    </div>
  );
}
