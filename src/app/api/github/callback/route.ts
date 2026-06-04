import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptToken } from "@/lib/crypto";

/** GitHub OAuth callback: exchange code, store an encrypted token. */
export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);
  if (!code) return NextResponse.redirect(`${origin}/?github=error`);

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    const token = tokenJson.access_token;
    if (!token) return NextResponse.redirect(`${origin}/?github=error`);

    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    });
    const ghUser = (await userRes.json()) as { login: string };

    await supabase.from("github_connections").upsert(
      {
        user_id: user.id,
        github_username: ghUser.login,
        access_token_encrypted: encryptToken(token),
      },
      { onConflict: "user_id" },
    );

    return NextResponse.redirect(`${origin}/?github=connected`);
  } catch {
    return NextResponse.redirect(`${origin}/?github=error`);
  }
}
