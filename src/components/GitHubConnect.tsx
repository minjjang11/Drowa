"use client";

import { useEffect, useState } from "react";

export function GitHubConnect() {
  const [state, setState] = useState<{ connected: boolean; username?: string | null } | null>(null);

  useEffect(() => {
    fetch("/api/github/status")
      .then((r) => r.json())
      .then(setState)
      .catch(() => setState({ connected: false }));
  }, []);

  if (!state) return null;

  if (state.connected) {
    return (
      <span className="flex items-center gap-1.5 rounded-[4px] border border-border bg-surface px-2.5 py-1.5 font-mono text-[11px] text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        @{state.username}
      </span>
    );
  }

  return (
    <a
      href="/api/github/connect"
      className="glow-hover rounded-[4px] border border-border bg-surface px-2.5 py-1.5 font-mono text-[11px] text-foreground transition-colors hover:border-accent"
    >
      Connect GitHub
    </a>
  );
}
