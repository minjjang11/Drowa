import type Anthropic from "@anthropic-ai/sdk";
import {
  MODEL,
  claude,
  extractCode,
  validateGeneratedCode,
} from "./claude";
import type { AgentActivity, AgentPlan, AgentProvider, AgentRole } from "./agents";
import { callProviderText, isProviderConfigured, MissingProviderKeyError } from "./agentProviders";

type ClaudeSystem = Anthropic.TextBlockParam[];
type ClaudeMessages = Anthropic.MessageParam[];

interface RunAgentPipelineParams {
  system: ClaudeSystem;
  messages: ClaudeMessages;
  plan: AgentPlan;
  userPrompt: string;
}

interface Candidate {
  source: "Claude" | "GPT";
  text: string;
  valid: boolean;
}

interface ReviewResult {
  role: AgentRole;
  provider: AgentProvider;
  fallback: boolean;
  pass: boolean;
  summary: string;
  issues: string[];
}

export interface AgentPipelineResult {
  reply: string;
  activities: AgentActivity[];
}

function textBlockContent(content: Anthropic.MessageParam["content"]): string {
  if (typeof content === "string") return content;
  return content
    .map((block) => {
      if (block.type === "text") return block.text;
      if (block.type === "image") return "[reference image attached]";
      return `[${block.type}]`;
    })
    .join("\n");
}

function systemText(system: ClaudeSystem): string {
  return system.map((block) => block.text).join("\n\n");
}

function conversationText(messages: ClaudeMessages): string {
  return messages.map((m) => `${m.role.toUpperCase()}:\n${textBlockContent(m.content)}`).join("\n\n");
}

async function askClaude(system: ClaudeSystem, messages: ClaudeMessages, maxTokens = 8000): Promise<string> {
  const res = await claude.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages,
  });
  return res.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n");
}

async function askClaudeText(system: string, prompt: string, maxTokens = 6000): Promise<string> {
  const res = await claude.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  return res.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n");
}

function validCandidate(source: Candidate["source"], text: string): Candidate {
  const code = extractCode(text);
  return {
    source,
    text,
    valid: code ? validateGeneratedCode(code).valid : true,
  };
}

function stripCode(text: string, limit = 700): string {
  return text.replace(/```[\s\S]*?```/g, "[code block]").trim().slice(0, limit);
}

function parseWinner(text: string): "Claude" | "GPT" | null {
  const json = parseJson(text) as { winner?: string } | null;
  const winner = json?.winner?.toLowerCase();
  if (winner === "a" || winner === "claude") return "Claude";
  if (winner === "b" || winner === "gpt") return "GPT";
  if (/\b(gpt|candidate b|winner["']?\s*:\s*["']?b)\b/i.test(text)) return "GPT";
  if (/\b(claude|candidate a|winner["']?\s*:\s*["']?a)\b/i.test(text)) return "Claude";
  return null;
}

function parseJson(text: string): unknown | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)?.[1];
  const raw = fenced ?? /\{[\s\S]*\}/.exec(text)?.[0];
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseReview(role: AgentRole, provider: AgentProvider, fallback: boolean, text: string): ReviewResult {
  const json = parseJson(text) as { pass?: boolean; summary?: string; issues?: string[] } | null;
  if (json && typeof json.pass === "boolean") {
    return {
      role,
      provider,
      fallback,
      pass: json.pass,
      summary: (json.summary ?? "").slice(0, 180),
      issues: Array.isArray(json.issues) ? json.issues.map(String).slice(0, 5) : [],
    };
  }

  const fail = /\b(fail|failed|bug|broken|must fix|blocking|regression|conflict)\b/i.test(text);
  return {
    role,
    provider,
    fallback,
    pass: !fail,
    summary: text.trim().slice(0, 180) || "review completed",
    issues: fail ? [text.trim().slice(0, 240)] : [],
  };
}

async function providerOrClaude(
  provider: Exclude<AgentProvider, "claude">,
  role: AgentRole,
  system: string,
  prompt: string,
): Promise<{ text: string; fallback: boolean }> {
  try {
    const result = await callProviderText(provider, system, prompt);
    return { text: result.text, fallback: false };
  } catch (err) {
    if (!(err instanceof MissingProviderKeyError)) throw err;
    const text = await askClaudeText(
      `${system}\n\nYou are temporarily standing in for ${provider.toUpperCase()} because its API key is not configured.`,
      prompt,
    );
    return { text, fallback: true };
  }
}

async function buildGptCandidate(system: string, conversation: string): Promise<{ candidate: Candidate; fallback: boolean }> {
  const prompt = `${conversation}

Create an alternative implementation for the user request.
Return the complete updated App.tsx in one tsx code block, followed by one short sentence.`;

  try {
    const result = await callProviderText("gpt", system, prompt);
    return { candidate: validCandidate("GPT", result.text), fallback: false };
  } catch (err) {
    if (!(err instanceof MissingProviderKeyError)) throw err;
    const text = await askClaudeText(
      `${system}\n\nAct as GPT, producing an independent second builder draft for comparison.`,
      prompt,
      8000,
    );
    return { candidate: validCandidate("GPT", text), fallback: true };
  }
}

async function chooseCandidate(system: string, a: Candidate, b: Candidate): Promise<Candidate> {
  if (a.valid && !b.valid) return a;
  if (!a.valid && b.valid) return b;
  if (!a.valid && !b.valid) return a;

  const prompt = `Pick the better implementation for Drowa.
Return JSON only: {"winner":"A"|"B","reason":"short reason"}.

Candidate A - Claude:
${a.text}

Candidate B - GPT:
${b.text}`;

  try {
    const result = isProviderConfigured("gpt")
      ? (await callProviderText("gpt", system, prompt)).text
      : await askClaudeText(system, prompt, 1000);
    return parseWinner(result) === "GPT" ? b : a;
  } catch {
    return a;
  }
}

async function reviewCode(
  provider: Exclude<AgentProvider, "claude">,
  role: AgentRole,
  system: string,
  userPrompt: string,
  reply: string,
): Promise<ReviewResult> {
  const code = extractCode(reply) ?? reply;
  const roleLine =
    role === "qa"
      ? "Review logic, state, edge cases, runtime errors, and broken assumptions."
      : role === "ux"
        ? "Review visual quality, layout hierarchy, spacing, responsive behavior, and Drowa's light editorial style."
        : "Review consistency with the project context, likely integration conflicts, and missing project-level assumptions.";

  const prompt = `${roleLine}

User request:
${userPrompt}

Candidate response:
${reply}

Candidate code:
\`\`\`tsx
${code}
\`\`\`

Return JSON only:
{"pass":true|false,"summary":"one short sentence","issues":["issue 1"]}`;

  const result = await providerOrClaude(provider, role, system, prompt);
  return parseReview(role, provider, result.fallback, result.text);
}

function activityFor(
  activities: AgentActivity[],
  provider: AgentProvider,
  patch: Partial<AgentActivity>,
): AgentActivity[] {
  return activities.map((agent) => (agent.provider === provider ? { ...agent, ...patch } : agent));
}

function detailFromReview(review: ReviewResult): string {
  if (review.fallback) return "Claude fallback reviewed";
  if (!review.pass) return "flagged issues";
  return review.summary || "check passed";
}

export async function runAgentPipeline({
  system,
  messages,
  plan,
  userPrompt,
}: RunAgentPipelineParams): Promise<AgentPipelineResult> {
  const sys = systemText(system);
  const convo = conversationText(messages);
  let activities = plan.activities;

  const claudeReply = await askClaude(system, messages);

  if (plan.pipeline === "fast") {
    return {
      reply: claudeReply,
      activities: activities.map((agent) =>
        agent.role === "builder" ? { ...agent, status: "done", detail: "focused edit prepared" } : agent,
      ),
    };
  }

  const { candidate: gptCandidate, fallback: gptFallback } = await buildGptCandidate(sys, convo);
  const claudeCandidate = validCandidate("Claude", claudeReply);
  const chosen = await chooseCandidate(sys, claudeCandidate, gptCandidate);

  activities = activityFor(activities, "claude", {
    status: "done",
    detail: chosen.source === "Claude" ? "Claude version chosen" : "GPT version selected",
  });
  activities = activityFor(activities, "gpt", {
    status: gptFallback ? "fallback" : "done",
    detail: gptFallback ? "Claude fallback drafted GPT pass" : "drafted and judged",
  });

  let reply = chosen.text;
  const [qa, ux, codebase] = await Promise.all([
    reviewCode("gpt", "qa", sys, userPrompt, reply),
    reviewCode("gemini", "ux", sys, userPrompt, reply),
    reviewCode("kimi", "codebase", sys, userPrompt, reply),
  ]);

  for (const review of [qa, ux, codebase]) {
    activities = activityFor(activities, review.provider, {
      status: review.fallback ? "fallback" : review.pass ? "done" : "failed",
      detail: detailFromReview(review),
    });
  }

  const failed = [qa, ux, codebase].filter((review) => !review.pass);
  if (failed.length) {
    const feedback = failed
      .map((review) => `${review.role.toUpperCase()}: ${review.issues.join("; ") || review.summary}`)
      .join("\n");
    const revision = await askClaude(system, [
      ...messages,
      { role: "assistant", content: reply },
      {
        role: "user",
        content: `The AI team found blocking issues. Fix them without changing unrelated behavior.

${feedback}

Return the complete corrected App.tsx in one tsx code block, followed by one short sentence.`,
      },
    ]);
    const revisedCode = extractCode(revision);
    if (revisedCode && validateGeneratedCode(revisedCode).valid) {
      reply = revision;
      activities = activityFor(activities, "claude", {
        status: "done",
        detail: "revised after team review",
      });
      activities = activities.map((agent) =>
        agent.status === "failed" ? { ...agent, status: "done", detail: "issues fed back" } : agent,
      );
    }
  }

  return { reply, activities };
}
