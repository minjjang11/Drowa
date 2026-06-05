import type { AiRole } from "./types";

export type AgentProvider = "claude" | "gpt" | "gemini" | "kimi";
export type AgentRole = "builder" | "qa" | "ux" | "codebase";
export type AgentStatus = "idle" | "active" | "done" | "fallback" | "failed";
export type AgentPipeline = "fast" | "reviewed";

export interface AgentActivity {
  id: string;
  name: string;
  provider: AgentProvider;
  role: AgentRole;
  status: AgentStatus;
  detail: string;
}

export interface AgentPlan {
  pipeline: AgentPipeline;
  activities: AgentActivity[];
  systemNote: string;
}

export const DEFAULT_AGENT_TEAM: AgentActivity[] = [
  {
    id: "claude-builder",
    name: "Claude",
    provider: "claude",
    role: "builder",
    status: "idle",
    detail: "ready to build",
  },
  {
    id: "gpt-qa",
    name: "GPT",
    provider: "gpt",
    role: "qa",
    status: "idle",
    detail: "ready to review logic",
  },
  {
    id: "gemini-ux",
    name: "Gemini",
    provider: "gemini",
    role: "ux",
    status: "idle",
    detail: "ready to check layout",
  },
  {
    id: "kimi-codebase",
    name: "Kimi",
    provider: "kimi",
    role: "codebase",
    status: "idle",
    detail: "ready to scan context",
  },
];

const SIMPLE_EDIT_RE =
  /(color|colour|text|copy|label|spacing|padding|margin|font|size|rename|change|swap|remove|delete|hide|show|button)/i;
const LARGE_REQUEST_RE =
  /(build|create|implement|add|feature|page|flow|auth|database|api|github|runtime|webcontainer|dashboard|redesign|full|entire|multi|complex)/i;

export function shouldUseReviewedPipeline(prompt: string): boolean {
  const p = prompt.trim();
  if (p.length > 180) return true;
  if (LARGE_REQUEST_RE.test(p)) return true;
  return !SIMPLE_EDIT_RE.test(p);
}

function active(id: string, detail: string): AgentActivity {
  const agent = DEFAULT_AGENT_TEAM.find((a) => a.id === id);
  if (!agent) throw new Error(`Unknown agent: ${id}`);
  return { ...agent, status: "active", detail };
}

export function buildAgentPlan(role: AiRole, prompt: string): AgentPlan {
  const reviewed = shouldUseReviewedPipeline(prompt);
  const activities = reviewed
    ? [
        active("claude-builder", role === "dev_ai" ? "writing code" : "shaping the UI"),
        active("gpt-qa", "reviewing logic"),
        active("gemini-ux", "checking the layout"),
        active("kimi-codebase", "checking project context"),
      ]
    : [active("claude-builder", role === "dev_ai" ? "making a focused edit" : "polishing the surface")];

  const systemNote = reviewed
    ? `Drowa V3 agent team mode is ON.
Act as the coordinated team, with Perplexity intentionally disabled:
- Claude: builder and architecture
- GPT: QA engineer and code review
- Gemini: UX/layout reviewer
- Kimi: long-context codebase analyst

Before finalizing, silently run the result through QA, UX, and codebase checks. Return one best final answer only.`
    : `Drowa V3 fast path is ON. Use Claude as the builder for this small edit. Keep the response quick and focused.`;

  return {
    pipeline: reviewed ? "reviewed" : "fast",
    activities,
    systemNote,
  };
}

export function finishAgentPlan(plan: AgentPlan, invalid: boolean): AgentActivity[] {
  return plan.activities.map((agent) => ({
    ...agent,
    status: invalid ? "failed" : "done",
    detail:
      agent.role === "builder"
        ? invalid
          ? "needs another pass"
          : "code prepared"
        : invalid
          ? "flagged an issue"
          : "check passed",
  }));
}
