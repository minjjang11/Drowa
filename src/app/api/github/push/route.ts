import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getConnection, getFileSha, putFile } from "@/lib/github";
import type { FileRow } from "@/lib/types";

/** Commit locally-changed files to the linked branch. Detects remote conflicts. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { projectId?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { projectId } = body;
  if (!projectId) return NextResponse.json({ error: "Missing projectId" }, { status: 400 });

  const conn = await getConnection(supabase, user.id);
  if (!conn) return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });

  const { data: link } = await supabase
    .from("github_links")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!link) return NextResponse.json({ error: "No GitHub link" }, { status: 400 });

  const { data: files } = await supabase.from("files").select("*").eq("project_id", projectId);
  const all = (files as FileRow[] | null) ?? [];
  const since = link.last_synced_at ? new Date(link.last_synced_at).getTime() : 0;
  const changed = all.filter(
    (f) => f.path !== "overrides.json" && new Date(f.updated_at).getTime() > since,
  );

  const message = body.message?.trim() || `Drowa: ${new Date().toISOString()}`;
  const repo = link.repo_full_name as string;
  const branch = link.branch as string;

  try {
    // Pre-flight conflict check: remote SHA must match the SHA we last synced.
    const conflicts: string[] = [];
    for (const f of changed) {
      const remoteSha = await getFileSha(conn.token, repo, f.path, branch);
      const knownSha = (f as FileRow & { github_sha?: string }).github_sha ?? null;
      if (remoteSha !== knownSha) conflicts.push(f.path);
    }
    if (conflicts.length) {
      return NextResponse.json(
        { error: "Remote has changes — pull first", conflicts },
        { status: 409 },
      );
    }

    const pushed: string[] = [];
    for (const f of changed) {
      const knownSha = (f as FileRow & { github_sha?: string }).github_sha ?? undefined;
      const newSha = await putFile(conn.token, repo, f.path, f.content, message, branch, knownSha);
      await supabase.from("files").update({ github_sha: newSha }).eq("id", f.id);
      pushed.push(f.path);
    }

    const syncedAt = new Date().toISOString();
    await supabase.from("github_links").update({ last_synced_at: syncedAt }).eq("id", link.id);

    return NextResponse.json({ pushed, syncedAt });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Push failed" },
      { status: 502 },
    );
  }
}
