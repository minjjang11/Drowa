import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getConnection, getTree, getFileContent, selectImportEntries } from "@/lib/github";
import type { FileRow } from "@/lib/types";

const MAX_FILES = 80;

/** Pull latest from the linked branch. resolve: "remote" | "local" forces conflict outcome. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { projectId?: string; resolve?: "remote" | "local" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { projectId, resolve } = body;
  if (!projectId) return NextResponse.json({ error: "Missing projectId" }, { status: 400 });

  const conn = await getConnection(supabase, user.id);
  if (!conn) return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });

  const { data: link } = await supabase
    .from("github_links")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!link) return NextResponse.json({ error: "No GitHub link" }, { status: 400 });

  const repo = link.repo_full_name as string;
  const branch = link.branch as string;
  const since = link.last_synced_at ? new Date(link.last_synced_at).getTime() : 0;

  const { data: files } = await supabase.from("files").select("*").eq("project_id", projectId);
  const localByPath = new Map(
    ((files as (FileRow & { github_sha?: string })[] | null) ?? []).map((f) => [f.path, f]),
  );

  try {
    const tree = selectImportEntries(await getTree(conn.token, repo, branch), MAX_FILES);

    const updated: string[] = [];
    const conflicts: string[] = [];

    for (const e of tree) {
      const local = localByPath.get(e.path);
      const remoteChanged = !local || local.github_sha !== e.sha;
      if (!remoteChanged) continue;

      const localChanged = local && new Date(local.updated_at).getTime() > since;

      if (local && localChanged && !resolve) {
        conflicts.push(e.path);
        continue;
      }
      if (local && localChanged && resolve === "local") continue; // keep local

      // take remote
      const { content, sha } = await getFileContent(conn.token, repo, e.path, branch);
      await supabase.from("files").upsert(
        { project_id: projectId, path: e.path, content, github_sha: sha },
        { onConflict: "project_id,path" },
      );
      updated.push(e.path);
    }

    if (conflicts.length && !resolve) {
      return NextResponse.json({ conflicts });
    }

    const syncedAt = new Date().toISOString();
    await supabase.from("github_links").update({ last_synced_at: syncedAt }).eq("id", link.id);
    return NextResponse.json({ updated, syncedAt });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Pull failed" },
      { status: 502 },
    );
  }
}
