import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Whether the current user has linked GitHub (no token exposed). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ connected: false });

  const { data } = await supabase
    .from("github_connections")
    .select("github_username")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    connected: !!data,
    username: data?.github_username ?? null,
  });
}
