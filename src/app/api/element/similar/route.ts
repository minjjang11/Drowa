import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { claude, MODEL, extractCode } from "@/lib/claude";
import { DEFAULT_TOKENS } from "@/lib/types";
import type { DesignTokens } from "@/lib/types";

// Phase 3-7 — "+ Add similar": clone a selected element into a new, similar one.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { projectId?: string; block?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { projectId, block } = body;
  if (!projectId || !block) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Pull design tokens so the clone stays on-system (RLS scopes to members).
  const { data: tokenRow } = await supabase
    .from("design_tokens")
    .select("tokens")
    .eq("project_id", projectId)
    .maybeSingle();
  const tokens = (tokenRow as { tokens: DesignTokens } | null)?.tokens ?? DEFAULT_TOKENS;

  const system = `You generate a single React + Tailwind JSX element for the Drowa platform.
Stay on the project's design system tokens:
${JSON.stringify(tokens, null, 2)}
Return ONLY the new element inside one \`\`\`tsx code block — no component wrapper, no imports, no prose.`;

  const userMsg = `Here is a React element from our codebase:

\`\`\`tsx
${block}
\`\`\`

Create a new similar element with different content. Keep the same visual style,
layout pattern, and design system tokens. Return only the new element JSX, ready
to insert immediately after the original.`;

  try {
    const res = await claude.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: userMsg }],
    });
    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n");
    const code = extractCode(text) ?? text.trim();
    if (!code) return NextResponse.json({ error: "No element returned" }, { status: 502 });
    return NextResponse.json({ code });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Claude request failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
