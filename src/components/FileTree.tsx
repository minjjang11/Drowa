"use client";

import { useState } from "react";

/**
 * Replit-style collapsible file rail. Phase 2 renders the single preview file;
 * structure is here so Phase 3 (multi-file) can drop in without layout churn.
 */
export function FileTree() {
  const [open, setOpen] = useState(false);
  const files = ["App.tsx"];

  if (!open) {
    return (
      <div className="flex w-10 shrink-0 flex-col items-center border-r border-border bg-surface py-2">
        <button
          onClick={() => setOpen(true)}
          title="Files"
          className="flex h-7 w-7 items-center justify-center rounded-[4px] font-mono text-sm text-muted transition-colors duration-150 hover:bg-background hover:text-foreground"
        >
          ▤
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-44 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex h-9 items-center justify-between border-b border-border px-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">Files</span>
        <button
          onClick={() => setOpen(false)}
          title="Collapse"
          className="flex h-5 w-5 items-center justify-center rounded-[3px] font-mono text-xs text-muted hover:bg-background hover:text-foreground"
        >
          ←
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5">
        {files.map((f) => (
          <div
            key={f}
            className="flex items-center gap-1.5 rounded-[3px] bg-background px-2 py-1.5 font-mono text-[12px] text-foreground"
          >
            <span className="text-muted">›</span>
            {f}
          </div>
        ))}
      </div>
    </div>
  );
}
