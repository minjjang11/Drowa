import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { claude, MODEL, buildRequest, extractCode } from "@/lib/claude";
import { DEFAULT_TOKENS } from "@/lib/types";
import type { AiRole, DesignTokens, FileRow, Message } from "@/lib/types";

const PREVIEW_PATH = "App.tsx";
const RECENT_LIMIT = 6;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { projectId?: string; role?: AiRole; prompt?: string; image?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { projectId, role, prompt, image } = body;
  if (!projectId || !prompt || (role !== "dev_ai" && role !== "design_ai")) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  // Parse an optional reference image data URL ("data:image/png;base64,...").
  let imagePayload: { mediaType: string; data: string } | null = null;
  if (image) {
    const m = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,(.+)$/.exec(image);
    if (m) imagePayload = { mediaType: m[1] === "image/jpg" ? "image/jpeg" : m[1], data: m[2] };
  }

  // RLS scopes all reads/writes below to project members only.
  const [{ data: contextRow }, { data: fileRow }, { data: tokenRow }, { data: recent }] =
    await Promise.all([
      supabase.from("context_md").select("content").eq("project_id", projectId).single(),
      supabase
        .from("files")
        .select("*")
        .eq("project_id", projectId)
        .eq("path", PREVIEW_PATH)
        .maybeSingle(),
      supabase.from("design_tokens").select("tokens").eq("project_id", projectId).maybeSingle(),
      supabase
        .from("messages")
        .select("*")
        .eq("project_id", projectId)
        .eq("role", role)
        .order("created_at", { ascending: false })
        .limit(RECENT_LIMIT),
    ]);

  const tokens = (tokenRow as { tokens: DesignTokens } | null)?.tokens ?? DEFAULT_TOKENS;

  const file = fileRow as FileRow | null;
  const recentMessages = ((recent as Message[] | null) ?? [])
    .reverse()
    .map((m) => ({
      sender: (m.user_id ? "user" : "ai") as "user" | "ai",
      content: m.content,
    }));

  const { system, messages } = buildRequest({
    role,
    tokens,
    contextMd: contextRow?.content ?? "",
    currentFile: file ? { path: file.path, content: file.content } : null,
    recentMessages,
    userPrompt: prompt,
    image: imagePayload,
  });

  let reply: string;
  try {
    const res = await claude.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system,
      messages,
    });
    reply = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Claude request failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const code = extractCode(reply);

  // Persist the user turn and the AI turn (same channel).
  await supabase.from("messages").insert([
    { project_id: projectId, user_id: user.id, role, content: prompt },
    { project_id: projectId, user_id: null, role, content: reply },
  ]);

  // If code was produced, reflect it in the preview file + log it to context.md.
  if (code) {
    await supabase
      .from("files")
      .upsert(
        { project_id: projectId, path: PREVIEW_PATH, content: code },
        { onConflict: "project_id,path" },
      );

    const note = reply.replace(/```[\s\S]*?```/g, "").trim().slice(0, 200);
    const channel = role === "dev_ai" ? "Developer AI" : "Designer AI";
    const base =
      contextRow?.content && contextRow.content.length > 0
        ? contextRow.content
        : "# Project Context\n\nLiving memory for this project. Auto-updated as the AIs work.\n\n## Changelog\n";
    const stamp = new Date().toISOString();
    const updated = `${base}\n- [${stamp}] ${channel}: ${note}`;
    await supabase
      .from("context_md")
      .update({ content: updated })
      .eq("project_id", projectId);
  }

  return NextResponse.json({ reply, code: code ?? null });
}
