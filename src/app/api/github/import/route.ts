import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getConnection, getTree, getFileContent, selectImportEntries } from "@/lib/github";
import { DEFAULT_TOKENS } from "@/lib/types";

const MAX_FILES = 80;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { repo?: string; branch?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const repo = body.repo;
  const branch = body.branch || "main";
  if (!repo) return NextResponse.json({ error: "Missing repo" }, { status: 400 });

  const conn = await getConnection(supabase, user.id);
  if (!conn) return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });

  try {
    const tree = selectImportEntries(await getTree(conn.token, repo, branch), MAX_FILES);

    // Create the project (trigger seeds membership + empty context_md row).
    const repoName = repo.split("/")[1] ?? repo;
    const { data: project, error: pErr } = await supabase
      .from("projects")
      .insert({ name: repoName, owner_id: user.id })
      .select()
      .single();
    if (pErr || !project) throw new Error(pErr?.message ?? "Project create failed");

    await supabase.from("design_tokens").insert({ project_id: project.id, tokens: DEFAULT_TOKENS });

    // Fetch contents (small concurrency) and persist.
    const rows: { project_id: string; path: string; content: string; github_sha: string }[] = [];
    let readme = "";
    for (let i = 0; i < tree.length; i += 6) {
      const batch = tree.slice(i, i + 6);
      const fetched = await Promise.all(
        batch.map(async (e) => {
          const { content, sha } = await getFileContent(conn.token, repo, e.path, branch);
          return { path: e.path, content, sha };
        }),
      );
      for (const f of fetched) {
        if (/^readme\.md$/i.test(f.path)) readme = f.content;
        rows.push({ project_id: project.id, path: f.path, content: f.content, github_sha: f.sha });
      }
    }

    if (rows.length) await supabase.from("files").insert(rows);

    // Build context.md from README or the file structure.
    const contextMd =
      readme.trim().length > 0
        ? readme
        : `## Project: ${repoName}\nImported from GitHub: ${repo}\nBranch: ${branch}\n\nFiles:\n${rows
            .map((r) => `- ${r.path}`)
            .join("\n")}`;
    await supabase.from("context_md").update({ content: contextMd }).eq("project_id", project.id);

    await supabase.from("github_links").insert({
      project_id: project.id,
      repo_full_name: repo,
      branch,
      last_synced_at: new Date().toISOString(),
    });

    return NextResponse.json({ projectId: project.id, imported: rows.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 502 },
    );
  }
}
