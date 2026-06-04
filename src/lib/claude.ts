import Anthropic from "@anthropic-ai/sdk";
import type { AiRole, DesignTokens } from "./types";

export const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/** Code-gen model. Spec calls for a claude-sonnet class model. */
export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

/** Stable, frozen system prompt — first in the prefix so it caches across requests. */
function systemPrompt(role: AiRole): string {
  const lens =
    role === "dev_ai"
      ? "You are the **Developer AI**. Focus on logic, state, data flow, structure, and correctness."
      : "You are the **Designer AI**. Focus on layout, color, typography, spacing, and visual polish.";

  return `You are an AI pair-builder inside Drowa, a collaborative build platform where a developer and a designer each work with their own AI on a shared project.

${lens}

OUTPUT CONTRACT — follow exactly:
- The project renders a SINGLE React component in a sandboxed preview.
- When the user asks for a UI/code change, return the COMPLETE, updated file as ONE \`\`\`tsx code block.
- The component must be a default export named \`App\`, self-contained, and use only React + inline Tailwind CSS classes (no imports beyond \`react\`).
- Do NOT use external packages, network calls, or browser APIs that need permissions.
- Keep prior working behavior unless the user asks to change it.
- After the code block, add 1-2 sentences describing what changed. No other prose.

If the request is a question (not a change), answer briefly with no code block.`;
}

/** Design-system contract — forces consistent, premium output regardless of prompt quality. */
function designSystemPrompt(tokens: DesignTokens): string {
  return `You are a UI code generator for the Drowa platform.
Always generate React + Tailwind code.
Always follow this project's design system:

${JSON.stringify(tokens, null, 2)}

Rules:
- Use only the colors defined in the design system above (use the hex values via Tailwind arbitrary classes, e.g. bg-[${tokens.colors.surface}], text-[${tokens.colors.textPrimary}]).
- Use "${tokens.typography.fontDisplay}" for headings, "${tokens.typography.fontUI}" for body, "${tokens.typography.fontMono}" for code.
- Spacing must follow the ${tokens.spacing.unit} scale: [${tokens.spacing.scale.join(", ")}] (in px).
- Border radius: sm ${tokens.radius.sm}, md ${tokens.radius.md}, lg ${tokens.radius.lg}, full ${tokens.radius.full}.
- Never use blue or indigo as accent unless defined in tokens.
- Output must look premium, not generic.
- When the user says vague things like 'Instagram feel' or 'minimal' or 'premium', interpret them as design intent and apply the closest matching current UI trend (bento grid, glassmorphism, layered cards, editorial, etc.) — still within the design system.`;
}

export interface BuildContextParams {
  role: AiRole;
  tokens: DesignTokens;
  contextMd: string;
  currentFile: { path: string; content: string } | null;
  /** Most recent turns, oldest-first. Caller slices to the last N (e.g. 6). */
  recentMessages: { sender: "user" | "ai"; content: string }[];
  userPrompt: string;
}

type Anthropic_MessageParam = Anthropic.MessageParam;

/**
 * Builds the request per the context-injection strategy:
 *   system (frozen) + context.md  → cached prefix
 *   + current file code           → cached (changes per file, not per turn)
 *   + last N messages             → volatile
 *   + user prompt                 → volatile
 */
export function buildRequest(p: BuildContextParams) {
  // System = frozen prompt + design system (cached) then context.md (cached).
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: systemPrompt(p.role) },
    { type: "text", text: designSystemPrompt(p.tokens) },
    {
      type: "text",
      text: `# Project context (context.md)\n\n${p.contextMd || "(empty — this is a new project)"}`,
      cache_control: { type: "ephemeral" },
    },
  ];

  const messages: Anthropic_MessageParam[] = [];

  // Current file code — stable across a turn-to-turn exchange on the same file.
  if (p.currentFile) {
    messages.push({
      role: "user",
      content: [
        {
          type: "text",
          text: `Current file \`${p.currentFile.path}\`:\n\n\`\`\`tsx\n${p.currentFile.content}\n\`\`\``,
          cache_control: { type: "ephemeral" },
        },
      ],
    });
    messages.push({
      role: "assistant",
      content: "Got it — I have the current file in mind.",
    });
  }

  // Last N turns (chat continuity), preserving who said what.
  for (const m of p.recentMessages) {
    messages.push({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.content,
    });
  }

  // The new user prompt — always last, never cached.
  messages.push({ role: "user", content: p.userPrompt });

  return { system, messages };
}

/** Pulls the first ```tsx / ```jsx code block out of a model reply, if any. */
export function extractCode(text: string): string | null {
  const match = text.match(/```(?:tsx|jsx|ts|js|react)?\s*\n([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}
