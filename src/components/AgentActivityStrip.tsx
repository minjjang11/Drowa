"use client";

import { useState } from "react";
import { runtimeLabel, type PreviewRuntimeDecision } from "@/lib/previewRuntime";
import type { AgentActivity } from "@/lib/agents";

interface AgentActivityStripProps {
  agents: AgentActivity[];
  runtime: PreviewRuntimeDecision;
  busy: boolean;
}

const ROLE_LABEL: Record<AgentActivity["role"], string> = {
  builder: "Builder",
  qa: "QA",
  ux: "UX",
  codebase: "Codebase",
};

export function AgentActivityStrip({ agents, runtime, busy }: AgentActivityStripProps) {
  const [collapsed, setCollapsed] = useState(false);
  const visibleAgents = agents.length ? agents : [];

  return (
    <div className="liquid-glass mx-3 mt-3 shrink-0 rounded-[8px] px-3 py-2">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${busy ? "amber-pulse bg-accent" : "bg-success"}`} />
          <span className="serif shrink-0 text-[15px] italic text-foreground">AI Team</span>
          <span className="truncate font-mono text-[10px] text-muted">
            {visibleAgents.length
              ? visibleAgents.map((agent) => `${agent.name} ${agent.detail}`).join(" / ")
              : "standing by"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-[9999px] border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-muted">
            {runtimeLabel(runtime.mode)} - {runtime.reason}
          </span>
          <span className="font-mono text-[10px] text-muted">{collapsed ? "+" : "-"}</span>
        </div>
      </button>

      {!collapsed && visibleAgents.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-1.5 lg:grid-cols-4">
          {visibleAgents.map((agent) => (
            <div
              key={agent.id}
              className="rounded-[5px] border border-border bg-white/45 px-2 py-1.5"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    agent.status === "active"
                      ? "amber-pulse bg-accent"
                      : agent.status === "done"
                        ? "bg-success"
                        : agent.status === "failed"
                          ? "bg-error"
                          : agent.status === "fallback"
                            ? "bg-muted"
                            : "bg-muted"
                  }`}
                />
                <span className="serif text-[13px] italic text-foreground">{agent.name}</span>
                <span className="font-mono text-[9px] uppercase text-muted">{ROLE_LABEL[agent.role]}</span>
              </div>
              <p className="mt-0.5 truncate font-mono text-[10px] text-muted">{agent.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
