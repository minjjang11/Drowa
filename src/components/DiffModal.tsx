"use client";

import { useEffect, useMemo, useState } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { createClient } from "@/lib/supabase/client";
import type { VersionRow, VersionSnapshot } from "@/lib/types";

// Phase 3-8 §7 — Monaco side-by-side diff of a snapshot vs current.
export function DiffModal({
  projectId,
  version,
  snapshot,
  onClose,
}: {
  projectId: string;
  version: VersionRow;
  snapshot: VersionSnapshot;
  onClose: () => void;
}) {
  // All paths present in either side, so renamed/deleted files still show.
  const paths = useMemo(() => {
    const set = new Set(snapshot.files.map((f) => f.path));
    return Array.from(set).sort();
  }, [snapshot]);

  const [path, setPath] = useState(paths.includes("App.tsx") ? "App.tsx" : paths[0] ?? "App.tsx");
  const [current, setCurrent] = useState<Record<string, string>>({});

  // Current contents for the chosen file (the right/modified side).
  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("files")
        .select("path, content")
        .eq("project_id", projectId);
      if (!active) return;
      const map: Record<string, string> = {};
      for (const f of (data as { path: string; content: string }[] | null) ?? []) map[f.path] = f.content;
      setCurrent(map);
    })();
    return () => {
      active = false;
    };
  }, [projectId]);

  const original = snapshot.files.find((f) => f.path === path)?.content ?? "";
  const modified = current[path] ?? "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
      <div className="grad-border flex h-[80vh] w-full max-w-5xl flex-col rounded-[8px] bg-surface shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
          <div className="flex items-center gap-3">
            <span className="serif text-[15px] italic text-foreground">Diff</span>
            <span className="font-mono text-[11px] text-muted">
              <span className="text-error">snapshot</span> → <span className="text-success">current</span>
            </span>
            {paths.length > 1 && (
              <select
                value={path}
                onChange={(e) => setPath(e.target.value)}
                className="input-dark rounded-[4px] px-2 py-0.5 font-mono text-[11px]"
              >
                {paths.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            )}
          </div>
          <button onClick={onClose} className="font-mono text-[11px] text-muted hover:text-foreground">
            close ✕
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <DiffEditor
            theme="vs-dark"
            language="typescript"
            original={original}
            modified={modified}
            options={{
              readOnly: true,
              renderSideBySide: true,
              minimap: { enabled: false },
              fontSize: 12,
              scrollBeyondLastLine: false,
            }}
          />
        </div>
        <div className="shrink-0 border-t border-border px-3 py-1.5 font-mono text-[10px] text-muted">
          {version.label}
        </div>
      </div>
    </div>
  );
}
