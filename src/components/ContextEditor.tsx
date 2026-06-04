"use client";

import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";

function timeAgo(iso: string | null, now: number): string {
  if (!iso) return "not saved yet";
  const diff = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (diff < 5) return "Saved just now";
  if (diff < 60) return `Saved ${diff}s ago`;
  if (diff < 3600) return `Saved ${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `Saved ${Math.floor(diff / 3600)}h ago`;
  return `Saved ${Math.floor(diff / 86400)}d ago`;
}

export function ContextEditor({
  content,
  updatedAt,
  onSave,
}: {
  content: string;
  updatedAt: string | null;
  onSave: (content: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"preview" | "raw">("preview");
  const [height, setHeight] = useState(300);
  const [now, setNow] = useState(() => Date.now());

  const draftRef = useRef(content);
  draftRef.current = mode === "raw" ? draftRef.current : content;

  // Refresh the "saved X ago" label.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(t);
  }, []);

  // Keep draft synced to incoming content when not actively editing raw.
  useEffect(() => {
    if (mode !== "raw") draftRef.current = content;
  }, [content, mode]);

  function saveIfDirty() {
    if (draftRef.current !== content) onSave(draftRef.current);
  }

  // Resizable drag handle.
  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    const startY = e.clientY;
    const startH = height;
    function move(ev: MouseEvent) {
      const next = Math.min(Math.max(startH + (startY - ev.clientY), 140), window.innerHeight * 0.7);
      setHeight(next);
    }
    function up() {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  if (!open) {
    return (
      <div className="flex h-9 shrink-0 items-center justify-between border-t border-border bg-surface px-4">
        <span className="font-mono text-[11px] text-muted">context.md</span>
        <button
          onClick={() => setOpen(true)}
          className="font-mono text-[11px] text-accent transition-opacity duration-150 hover:opacity-80"
        >
          ✎ Edit
        </button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col border-t border-border bg-surface" style={{ height }}>
      <div
        onMouseDown={startResize}
        className="h-1.5 shrink-0 cursor-ns-resize bg-background hover:bg-border"
        title="Drag to resize"
      />
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] font-medium text-foreground">context.md</span>
          <div className="flex items-center gap-0.5 rounded-[5px] border border-border bg-background p-0.5">
            <button
              onClick={() => {
                saveIfDirty();
                setMode("preview");
              }}
              className={`rounded-[3px] px-2 py-0.5 font-mono text-[11px] transition-colors duration-150 ${
                mode === "preview" ? "bg-surface text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-muted hover:text-foreground"
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => setMode("raw")}
              className={`rounded-[3px] px-2 py-0.5 font-mono text-[11px] transition-colors duration-150 ${
                mode === "raw" ? "bg-surface text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-muted hover:text-foreground"
              }`}
            >
              Raw
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-muted">{timeAgo(updatedAt, now)}</span>
          <button
            onClick={() => {
              saveIfDirty();
              setOpen(false);
            }}
            className="font-mono text-[11px] text-muted transition-colors duration-150 hover:text-foreground"
          >
            ✕ close
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {mode === "raw" ? (
          <Editor
            height="100%"
            defaultLanguage="markdown"
            value={content}
            theme="vs"
            onChange={(v) => {
              draftRef.current = v ?? "";
            }}
            onMount={(editor) => {
              editor.onDidBlurEditorText(() => saveIfDirty());
            }}
            options={{
              minimap: { enabled: false },
              fontSize: 12,
              fontFamily: "var(--font-geist-mono), monospace",
              lineNumbers: "on",
              wordWrap: "on",
              scrollBeyondLastLine: false,
              padding: { top: 10 },
            }}
          />
        ) : (
          <div className="prose-drowa h-full overflow-y-auto px-6 py-4 text-[13px] leading-relaxed">
            {content.trim() ? (
              <ReactMarkdown>{content}</ReactMarkdown>
            ) : (
              <p className="font-mono text-[11px] text-muted">
                Empty. Switch to Raw to write the project context — the AIs read this on every request.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
