import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { HomeHero } from "@/components/HomeHero";
import { TemplateGallery } from "@/components/TemplateGallery";
import { relativeTime } from "@/lib/versionMeta";
import type { MemberRole, Project } from "@/lib/types";

const RECENT_LIMIT = 5;

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: projects }, { data: members }, { data: links }] = await Promise.all([
    supabase.from("projects").select("*").order("updated_at", { ascending: false }),
    supabase.from("project_members").select("project_id, role").eq("user_id", user.id),
    supabase.from("github_links").select("project_id"),
  ]);

  const roleByProject = new Map<string, MemberRole>(
    ((members as { project_id: string; role: MemberRole }[] | null) ?? []).map((m) => [m.project_id, m.role]),
  );
  const linkedSet = new Set(
    ((links as { project_id: string }[] | null) ?? []).map((l) => l.project_id),
  );
  const list = (projects as Project[] | null) ?? [];
  const recent = list.slice(0, RECENT_LIMIT);

  return (
    <div className="noise min-h-screen bg-background">
      {/* 1. Top bar */}
      <header className="grad-border-bottom flex items-center justify-between bg-surface px-6 py-3">
        <span className="font-mono text-sm font-semibold text-foreground">drowa</span>
        <div className="flex items-center gap-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-[9999px] bg-gradient-to-br from-accent to-accent-2 font-mono text-[10px] font-semibold text-[#0d0d0d]">
            {(user.email ?? "?")[0]?.toUpperCase()}
          </span>
          <span className="font-mono text-[11px] text-muted">{user.email}</span>
          <form action={signOut}>
            <button className="rounded-[4px] border border-border bg-surface px-3 py-1.5 font-mono text-xs text-muted transition-colors duration-150 hover:text-foreground">
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* 2. Recent projects (only if any exist) */}
      {list.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted">Recent</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {recent.map((p) => {
              const role = roleByProject.get(p.id) ?? "developer";
              const tag = role === "designer" ? "DESIGN" : "DEV";
              return (
                <Link
                  key={p.id}
                  href={`/project/${p.id}`}
                  className="grad-hover group flex w-56 shrink-0 flex-col gap-2 rounded-[10px] bg-surface p-4 hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="serif truncate text-base italic text-foreground">{p.name}</span>
                    <span className={`shrink-0 font-mono text-[9px] font-semibold tracking-wider ${tag === "DESIGN" ? "text-accent-2" : "text-accent"}`}>
                      [{tag}]
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px] text-muted">
                    <span>{relativeTime(p.updated_at)}</span>
                    {linkedSet.has(p.id) && <span title="GitHub connected">⑂</span>}
                  </div>
                </Link>
              );
            })}
            {list.length > RECENT_LIMIT && (
              <Link
                href="/projects"
                className="flex w-32 shrink-0 items-center justify-center rounded-[10px] border border-dashed border-border font-mono text-[11px] text-muted transition-colors hover:border-accent hover:text-foreground"
              >
                + See all
              </Link>
            )}
          </div>
        </section>
      )}

      {/* 3. Hero */}
      <HomeHero />

      {/* 4. Template & inspiration gallery */}
      <TemplateGallery />
    </div>
  );
}
