"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { DeviceMode, Status } from "@/lib/types";

const DEVICES: { id: DeviceMode; label: string; icon: string }[] = [
  { id: "desktop", label: "Desktop", icon: "▢" },
  { id: "tablet", label: "Tablet", icon: "▯" },
  { id: "mobile", label: "Mobile", icon: "▮" },
];

const STATUS_META: Record<Status, { label: string; dot: string; spin?: boolean }> = {
  ready: { label: "Ready", dot: "bg-success" },
  generating: { label: "Generating…", dot: "bg-accent", spin: true },
  saved: { label: "Saved", dot: "bg-muted" },
  error: { label: "Error", dot: "bg-error" },
};

export function Toolbar({
  projectId,
  projectName,
  status,
  device,
  onDevice,
  onExport,
  onDeploy,
  onOpenDesign,
}: {
  projectId: string;
  projectName: string;
  status: Status;
  device: DeviceMode;
  onDevice: (d: DeviceMode) => void;
  onExport: () => void;
  onDeploy: () => void;
  onOpenDesign: () => void;
}) {
  const [name, setName] = useState(projectName);
  const meta = STATUS_META[status];

  async function commitName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === projectName) {
      setName(projectName);
      return;
    }
    const supabase = createClient();
    await supabase.from("projects").update({ name: trimmed }).eq("id", projectId);
  }

  return (
    <header className="grad-border-bottom flex h-11 shrink-0 items-center justify-between bg-surface px-3">
      {/* Left: logo + editable name */}
      <div className="flex items-center gap-2">
        <Link href="/" className="font-mono text-xs font-semibold text-foreground transition-colors hover:text-accent">
          drowa
        </Link>
        <span className="text-border">/</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="serif w-44 rounded-[3px] border border-transparent bg-transparent px-1.5 py-0.5 text-base italic text-foreground outline-none transition-colors hover:border-border focus:border-accent"
        />
      </div>

      {/* Center: device pill switcher */}
      <div className="flex items-center gap-0.5 rounded-[5px] border border-border bg-background p-0.5">
        {DEVICES.map((d) => (
          <button
            key={d.id}
            onClick={() => onDevice(d.id)}
            title={d.label}
            className={`flex items-center gap-1.5 rounded-[3px] px-2.5 py-1 font-mono text-[11px] transition-colors duration-150 ${
              device === d.id
                ? "bg-surface-elevated text-accent shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
                : "text-muted hover:text-foreground"
            }`}
          >
            <span>{d.icon}</span>
            {d.label}
          </button>
        ))}
      </div>

      {/* Right: design system + status + export + deploy */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenDesign}
          title="Design System"
          className="glow-hover flex h-7 w-7 items-center justify-center rounded-[4px] border border-border bg-background text-sm text-accent transition-colors hover:border-accent"
        >
          ◈
        </button>
        <div className="flex items-center gap-1.5 rounded-[4px] border border-border bg-background px-2 py-1 font-mono text-[11px] text-muted">
          <span
            className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${meta.spin ? "amber-pulse" : ""}`}
          />
          {meta.label}
        </div>
        <button
          onClick={onExport}
          className="btn-grad rounded-[4px] px-2.5 py-1 font-mono text-[11px] text-muted hover:text-foreground"
        >
          Export
        </button>
        <button
          onClick={onDeploy}
          className="btn-grad rounded-[4px] px-2.5 py-1 font-mono text-[11px] font-medium text-foreground"
        >
          Deploy
        </button>
      </div>
    </header>
  );
}
