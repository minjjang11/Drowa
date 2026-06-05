import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { snapshotProject } from "@/lib/versions";
import type { VersionSnapshot } from "@/lib/types";

// Phase 3-8 §6 — restore a version: snapshot current state first, then overwrite
// files + context.md with the chosen snapshot, and log the restore.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { projectId?: string; versionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { projectId, versionId } = body;
  if (!projectId || !versionId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { data: ver } = await supabase
    .from("versions")
    .select("label, snapshot")
    .eq("id", versionId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!ver) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  const label = (ver as { label: string }).label;
  const snapshot = (ver as { snapshot: VersionSnapshot }).snapshot;

  // 1. Safety net — preserve current work before clobbering it.
  await snapshotProject(supabase, projectId, user.id, null, "pre_restore");

  // 2. Overwrite files: upsert snapshot files, drop any not in the snapshot.
  const keepPaths = snapshot.files.map((f) => f.path);
  if (snapshot.files.length) {
    await supabase.from("files").upsert(
      snapshot.files.map((f) => ({ project_id: projectId, path: f.path, content: f.content })),
      { onConflict: "project_id,path" },
    );
  }
  // Remove files that no longer exist in the snapshot (keepPaths may be empty).
  let del = supabase.from("files").delete().eq("project_id", projectId);
  if (keepPaths.length) del = del.not("path", "in", `(${keepPaths.map((p) => `"${p}"`).join(",")})`);
  await del;

  // 3 + 9. Overwrite context.md and append the restore log.
  const stamp = new Date().toISOString();
  const restoredContext = `${snapshot.context_md.trim()}\n\n## ${stamp} — Restored to version: ${label}\nAll files reverted to this snapshot.`;
  await supabase.from("context_md").update({ content: restoredContext }).eq("project_id", projectId);

  return NextResponse.json({ ok: true, label });
}
