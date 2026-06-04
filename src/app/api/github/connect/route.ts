import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Kick off the GitHub OAuth flow (scope: repo for read+write). */
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(`${origin}/?github=misconfigured`);
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? origin;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${base}/api/github/callback`,
    scope: "repo",
    state: user.id,
  });
  return NextResponse.redirect(`https://github.com/login/oauth/authorize?${params}`);
}
