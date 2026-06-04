import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getConnection, listRepos, listBranches } from "@/lib/github";

/** List the user's repos, or branches for a repo when ?repo= is given. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const repo = searchParams.get("repo");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conn = await getConnection(supabase, user.id);
  if (!conn) return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });

  try {
    if (repo) {
      return NextResponse.json({ branches: await listBranches(conn.token, repo) });
    }
    return NextResponse.json({ repos: await listRepos(conn.token) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "GitHub error" },
      { status: 502 },
    );
  }
}
