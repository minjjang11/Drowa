// Phase 3-8 — client-safe helpers for the version history UI (no server imports).
import type { VersionTrigger } from "./types";

/** Badge label + Tailwind classes per trigger (3-8 design rules). */
export const TRIGGER_META: Record<VersionTrigger, { label: string; cls: string }> = {
  manual: { label: "Manual", cls: "text-accent border-accent/50" },
  ai_generation: { label: "AI", cls: "text-[#8b5cf6] border-[#8b5cf6]/50" },
  template_insert: { label: "Template", cls: "text-accent-2 border-accent-2/50" },
  github_sync: { label: "GitHub", cls: "text-success border-success/50" },
  auto_fix: { label: "Auto-fix", cls: "text-error border-error/50" },
  pre_restore: { label: "Pre-restore", cls: "text-muted border-border" },
};

export function isManual(t: VersionTrigger): boolean {
  return t === "manual";
}

/** "Auto: AI generation — Jun 5, 14:32" style label for auto-snapshots. */
export function autoLabel(trigger: VersionTrigger, when: Date = new Date()): string {
  const human: Partial<Record<VersionTrigger, string>> = {
    ai_generation: "AI generation",
    template_insert: "template insert",
    github_sync: "GitHub sync",
    auto_fix: "auto-fix",
    pre_restore: "before restore",
  };
  const stamp = when.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `Auto: ${human[trigger] ?? trigger} — ${stamp}`;
}

/** "2 hours ago" relative time. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}
