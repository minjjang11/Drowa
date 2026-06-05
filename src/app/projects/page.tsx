import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { relativeTime } from "@/lib/versionMeta";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import type { MemberRole, Project } from "@/lib/types";

export default async function AllProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: projects }, { data: members }] = await Promise.all([
    supabase.from("projects").select("*").order("updated_at", { ascending: false }),
    supabase.from("project_members").select("project_id, role").eq("user_id", user.id),
  ]);

  const roleByProject = new Map<string, MemberRole>(
    ((members as { project_id: string; role: MemberRole }[] | null) ?? []).map((m) => [m.project_id, m.role]),
  );
  const list = (projects as Project[] | null) ?? [];

  return (
    <div className="noise min-h-screen bg-background">
      <header className="grad-border-bottom flex items-center justify-between bg-surface px-6 py-3">
        <Link href="/" className="font-mono text-sm font-semibold text-foreground hover:text-accent">
          drowa
        </Link>
        <Link href="/" className="font-mono text-xs text-muted hover:text-foreground">
          ← Home
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="serif mb-6 text-2xl italic">All projects</h1>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => {
            const role = roleByProject.get(p.id) ?? "developer";
            const tag = role === "designer" ? "DESIGN" : "DEV";
            return (
              <div key={p.id} className="group relative">
                <DeleteProjectButton projectId={p.id} name={p.name} />
                <Link
                  href={`/project/${p.id}`}
                  className="grad-hover flex flex-col gap-3 rounded-[8px] bg-surface p-4 hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between">
                    <span className="serif text-base text-foreground">{p.name}</span>
                    <span className={`font-mono text-[9px] font-semibold tracking-wider ${tag === "DESIGN" ? "text-accent-2" : "text-accent"}`}>
                      [{tag}]
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-muted">{relativeTime(p.updated_at)}</span>
                </Link>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
