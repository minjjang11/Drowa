"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TRIGGER_META, isManual, relativeTime } from "@/lib/versionMeta";
import type { VersionRow, VersionSnapshot } from "@/lib/types";

// Phase 3-8 §4 — right-side timeline of snapshots.
export function VersionHistoryPanel({
  projectId,
  refreshKey,
  onClose,
  onPreview,
  onRestore,
  onDiff,
  onSaveVersion,
}: {
  projectId: string;
  /** Bump to force a reload (after save / restore). */
  refreshKey: number;
  onClose: () => void;
  onPreview: (v: VersionRow, snapshot: VersionSnapshot) => void;
  onRestore: (v: VersionRow) => void;
  onDiff: (v: VersionRow, snapshot: VersionSnapshot) => void;
  onSaveVersion: () => void;
}) {
  const [rows, setRows] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("versions")
        .select("id, project_id, label, trigger, created_by, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (active) {
        setRows((data as VersionRow[] | null) ?? []);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [projectId, refreshKey]);

  // Snapshot blobs are heavy — fetch only when Preview/Diff is clicked.
  const loadSnapshot = useCallback(async (id: string): Promise<VersionSnapshot | null> => {
    const supabase = createClient();
    const { data } = await supabase.from("versions").select("snapshot").eq("id", id).maybeSingle();
    return (data as { snapshot: VersionSnapshot } | null)?.snapshot ?? null;
  }, []);

  return (
    <aside className="grad-border absolute right-0 top-0 z-30 flex h-full w-80 flex-col bg-surface shadow-[-4px_0_24px_rgba(0,0,0,0.5)]">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="serif text-[15px] italic text-foreground">Version history</span>
        <button onClick={onClose} className="font-mono text-[11px] text-muted hover:text-foreground">
          close ✕
        </button>
      </div>

      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <span className="font-mono text-[10px] text-muted">{rows.length} versions saved</span>
        <button
          onClick={onSaveVersion}
          className="btn-grad rounded-[4px] px-2.5 py-1 font-mono text-[10px] font-medium text-foreground"
        >
          + Save version
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading && <p className="px-1 py-2 font-mono text-[11px] text-muted">Loading…</p>}
        {!loading && rows.length === 0 && (
          <p className="px-1 py-2 font-mono text-[11px] text-muted">
            No versions yet. Snapshots are taken automatically before AI edits.
          </p>
        )}
        {rows.map((v) => {
          const meta = TRIGGER_META[v.trigger] ?? TRIGGER_META.manual;
          return (
            <div
              key={v.id}
              className={`mb-1.5 rounded-[5px] border-l-2 bg-surface-elevated px-2.5 py-2 ${
                isManual(v.trigger) ? "border-accent" : "border-border"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`rounded-[3px] border px-1.5 py-0.5 font-mono text-[9px] ${meta.cls}`}>
                  {meta.label}
                </span>
                <span className="font-mono text-[10px] text-muted">{relativeTime(v.created_at)}</span>
              </div>
              <p className="mt-1 line-clamp-2 font-sans text-[12px] text-foreground">{v.label}</p>
              <div className="mt-1.5 flex gap-2">
                <button
                  onClick={async () => {
                    const snap = await loadSnapshot(v.id);
                    if (snap) onPreview(v, snap);
                  }}
                  className="font-mono text-[10px] text-muted hover:text-accent"
                >
                  Preview
                </button>
                <button
                  onClick={async () => {
                    const snap = await loadSnapshot(v.id);
                    if (snap) onDiff(v, snap);
                  }}
                  className="font-mono text-[10px] text-muted hover:text-accent"
                >
                  Diff
                </button>
                <button
                  onClick={() => onRestore(v)}
                  className="font-mono text-[10px] text-accent hover:opacity-80"
                >
                  Restore
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
