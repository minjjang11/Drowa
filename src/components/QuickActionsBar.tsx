"use client";

import { useEffect, useState } from "react";
import type { QuickAction } from "@/lib/quickActions";

export function QuickActionsBar({
  actions,
  busy,
  onFire,
  onAdd,
}: {
  actions: QuickAction[];
  busy: boolean;
  onFire: (promptTemplate: string) => void;
  onAdd: () => void;
}) {
  const [firingId, setFiringId] = useState<string | null>(null);

  // Clear the loading pill once generation finishes.
  useEffect(() => {
    if (!busy) setFiringId(null);
  }, [busy]);

  return (
    <div className="shrink-0 border-t border-border px-2 pt-2">
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {actions.map((a) => {
          const firing = firingId === a.id;
          return (
            <button
              key={a.id}
              disabled={busy}
              onClick={() => {
                setFiringId(a.id);
                onFire(a.promptTemplate);
              }}
              title={a.label}
              className={`glow-hover flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[4px] border bg-surface-elevated px-2 py-1 text-[11px] transition-colors disabled:opacity-50 ${
                firing ? "amber-pulse border-accent text-accent" : "border-border text-foreground hover:border-accent"
              }`}
            >
              <span>{a.icon}</span>
              {a.label}
            </button>
          );
        })}
        <button
          onClick={onAdd}
          disabled={busy}
          title="New custom action"
          className="glow-hover flex shrink-0 items-center justify-center rounded-[4px] border border-dashed border-[#3a3a30] px-2 py-1 text-[11px] text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          +
        </button>
      </div>
    </div>
  );
}
