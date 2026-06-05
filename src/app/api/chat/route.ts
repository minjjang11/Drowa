import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildRequest, extractCode, validateGeneratedCode } from "@/lib/claude";
import { processForPreview } from "@/lib/codeProcessor";
import { snapshotProject } from "@/lib/versions";
import { DEFAULT_TOKENS } from "@/lib/types";
import { buildAgentPlan, finishAgentPlan } from "@/lib/agents";
import { runAgentPipeline } from "@/lib/agentPipeline";
import type { AgentActivity } from "@/lib/agents";
import type { AiRole, DesignTokens, FileRow, Message, VersionTrigger } from "@/lib/types";

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

  let body: {
    projectId?: string;
    role?: AiRole;
    prompt?: string;
    image?: string;
    trigger?: VersionTrigger;
    /** Preview a result (e.g. auto-fix) without writing anything to the DB. */
    dryRun?: boolean;
  };
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

  const agentPlan = buildAgentPlan(role, prompt);
  const { system, messages } = buildRequest({
    role,
    tokens,
    contextMd: contextRow?.content ?? "",
    currentFile: file ? { path: file.path, content: file.content } : null,
    recentMessages,
    userPrompt: prompt,
    image: imagePayload,
    agentNote: agentPlan.systemNote,
  });

  let reply: string;
  let finalAgents: AgentActivity[] = agentPlan.activities;
  let runRows: { id: string; role: string; model: string }[] = [];
  if (!body.dryRun) {
    try {
      const { data } = await supabase
        .from("agent_runs")
        .insert(
          agentPlan.activities.map((agent) => ({
            project_id: projectId,
            role: agent.role,
            model: agent.provider,
            status: "active",
            output_ref: agent.detail,
            chosen: false,
          })),
        )
        .select("id, role, model");
      runRows = (data as { id: string; role: string; model: string }[] | null) ?? [];
    } catch {
      // Phase 4 schema may not be applied yet; chat should still work.
    }
  }
  try {
    const result = await runAgentPipeline({
      system,
      messages,
      plan: agentPlan,
      userPrompt: prompt,
    });
    reply = result.reply;
    finalAgents = result.activities;

    // Generation quality guard: validate the code block, auto-retry once.
    let code0 = extractCode(reply);
    if (code0) {
      const check = validateGeneratedCode(code0);
      if (!check.valid) {
        finalAgents = finalAgents.map((agent) =>
          agent.role === "builder"
            ? { ...agent, status: "failed", detail: check.reason ?? "code failed validation" }
            : agent,
        );
      }
    }
  } catch (e) {
    if (runRows.length) {
      await Promise.all(
        runRows.map((row) =>
          supabase
            .from("agent_runs")
            .update({ status: "failed", output_ref: "request failed" })
            .eq("id", row.id),
        ),
      );
    }
    const msg = e instanceof Error ? e.message : "AI team request failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const rawCode = extractCode(reply);
  const codeValid = rawCode ? validateGeneratedCode(rawCode).valid : true;
  // Normalize to the iframe's bare-App format before storing/returning.
  const code = rawCode ? processForPreview(rawCode) : null;
  const responseAgents = codeValid ? finalAgents : finishAgentPlan(agentPlan, true);

  // Dry run (safe auto-fix preview): return the proposal, touch nothing.
  if (body.dryRun) {
    return NextResponse.json({
      reply,
      code: code ?? null,
      invalid: !codeValid,
      pipeline: agentPlan.pipeline,
      agents: responseAgents,
    });
  }

  // Persist the user turn and the AI turn (same channel).
  const { data: savedMessages } = await supabase.from("messages").insert([
    { project_id: projectId, user_id: user.id, role, content: prompt },
    { project_id: projectId, user_id: null, role, content: reply },
  ]).select("id, user_id");
  const aiMessageId =
    (savedMessages as { id: string; user_id: string | null }[] | null)?.find((m) => !m.user_id)?.id ?? null;

  try {
    if (runRows.length) {
      await Promise.all(
        responseAgents.map((agent) => {
          const row = runRows.find((r) => r.model === agent.provider && r.role === agent.role);
          if (!row) return Promise.resolve();
          return supabase
            .from("agent_runs")
            .update({
              message_id: aiMessageId,
              status: agent.status,
              output_ref: agent.detail,
              chosen: agent.role === "builder" && /chosen|selected|prepared|revised/i.test(agent.detail),
            })
            .eq("id", row.id);
        }),
      );
    } else {
      await supabase.from("agent_runs").insert(
        responseAgents.map((agent) => ({
          project_id: projectId,
          message_id: aiMessageId,
          role: agent.role,
          model: agent.provider,
          status: agent.status,
          output_ref: agent.detail,
          chosen: agent.role === "builder" && /chosen|selected|prepared|revised/i.test(agent.detail),
        })),
      );
    }
  } catch {
    // Phase 4 schema may not be applied yet; chat should still work.
  }

  // If code was produced, reflect it in the preview file + log it to context.md.
  if (code && codeValid) {
    // 3-8: snapshot the pre-change state before overwriting the file.
    const trigger: VersionTrigger = body.trigger === "auto_fix" ? "auto_fix" : "ai_generation";
    await snapshotProject(supabase, projectId, user.id, null, trigger);

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

  return NextResponse.json({
    reply,
    code: code ?? null,
    invalid: !codeValid,
    pipeline: agentPlan.pipeline,
    agents: responseAgents,
  });
}
