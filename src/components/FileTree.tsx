"use client";

import { useState } from "react";

/**
 * Replit-style collapsible file rail. Phase 2 renders the single preview file;
 * right-click → "Save as template" (Phase 3-2).
 */
export function FileTree({ onSaveTemplate }: { onSaveTemplate: () => void }) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const files = ["App.tsx"];

  function openMenu(e: React.MouseEvent) {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  }

  const contextMenu = menu && (
    <>
      <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
      <div
        className="grad-border fixed z-50 rounded-[6px] bg-surface py-1 shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
        style={{ left: menu.x, top: menu.y }}
      >
        <button
          onClick={() => {
            setMenu(null);
            onSaveTemplate();
          }}
          className="block w-full px-3 py-1.5 text-left font-mono text-[11px] text-foreground hover:bg-surface-elevated hover:text-accent"
        >
          Save as template
        </button>
      </div>
    </>
  );

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
            onContextMenu={openMenu}
            className="flex cursor-default items-center gap-1.5 rounded-[3px] bg-background px-2 py-1.5 font-mono text-[12px] text-foreground"
          >
            <span className="text-muted">›</span>
            {f}
          </div>
        ))}
        <p className="px-2 pt-2 font-mono text-[9px] leading-snug text-muted">
          right-click → save as template
        </p>
      </div>
      {contextMenu}
    </div>
  );
}
