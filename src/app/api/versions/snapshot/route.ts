import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { snapshotProject } from "@/lib/versions";
import type { VersionTrigger } from "@/lib/types";

const TRIGGERS: VersionTrigger[] = [
  "manual",
  "ai_generation",
  "template_insert",
  "github_sync",
  "auto_fix",
  "pre_restore",
];

// Phase 3-8 — create a snapshot (manual save, or client-driven auto-snapshot
// before a template insert / GitHub sync).
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { projectId?: string; label?: string; trigger?: VersionTrigger };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { projectId, label } = body;
  const trigger: VersionTrigger = TRIGGERS.includes(body.trigger as VersionTrigger)
    ? (body.trigger as VersionTrigger)
    : "manual";
  if (!projectId) return NextResponse.json({ error: "Missing projectId" }, { status: 400 });

  try {
    await snapshotProject(supabase, projectId, user.id, label ?? null, trigger);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Snapshot failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
