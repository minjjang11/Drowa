import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { NewProjectButton } from "@/components/NewProjectButton";
import { GitHubConnect } from "@/components/GitHubConnect";
import type { MemberRole, Project } from "@/lib/types";

const HINTS = [
  { icon: "⚡", title: "AI Generate", desc: "Prompt to UI in seconds", color: "text-accent" },
  { icon: "🎨", title: "Visual Edit", desc: "Click to edit anything", color: "text-accent-2" },
  { icon: "👥", title: "Collaborate", desc: "Dev + Designer, one screen", color: "text-[#8b5cf6]" },
];

export default async function HomePage() {
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
    ((members as { project_id: string; role: MemberRole }[] | null) ?? []).map((m) => [
      m.project_id,
      m.role,
    ]),
  );
  const list = (projects as Project[] | null) ?? [];

  return (
    <div className="min-h-screen">
      <header className="grad-border-bottom flex items-center justify-between bg-surface px-6 py-3">
        <span className="font-mono text-sm font-semibold">drowa</span>
        <div className="flex items-center gap-3">
          <GitHubConnect />
          <span className="font-mono text-[11px] text-muted">{user.email}</span>
          <form action={signOut}>
            <button className="rounded-[4px] border border-border bg-surface px-3 py-1.5 font-mono text-xs text-muted transition-colors duration-150 hover:text-foreground">
              Sign out
            </button>
          </form>
        </div>
      </header>

      {list.length === 0 ? (
        <EmptyState />
      ) : (
        <main className="mx-auto max-w-5xl px-6 py-10">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="serif text-2xl italic">My Projects</h1>
            <NewProjectButton variant="button" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => (
              <ProjectCard key={p.id} project={p} role={roleByProject.get(p.id) ?? "developer"} />
            ))}
          </div>
        </main>
      )}
    </div>
  );
}

function ProjectCard({ project, role }: { project: Project; role: MemberRole }) {
  const tag = role === "designer" ? "DESIGN" : "DEV";
  return (
    <Link
      href={`/project/${project.id}`}
      className="grad-hover group flex flex-col gap-3 rounded-[8px] bg-surface p-4 hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between">
        <span className="serif text-base italic text-foreground">{project.name}</span>
        <span className={`font-mono text-[9px] font-semibold tracking-wider ${tag === "DESIGN" ? "text-accent-2" : "text-accent"}`}>
          [{tag}]
        </span>
      </div>
      <span className="font-mono text-[11px] text-muted">
        {new Date(project.updated_at).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </span>
    </Link>
  );
}

function EmptyState() {
  return (
    <main className="flex flex-col items-center justify-center gap-8 px-6 py-24">
      <div className="text-center">
        <h1 className="serif text-6xl italic tracking-tight text-foreground">Drowa</h1>
        <p className="mt-3 font-sans text-sm text-muted">Build together. Ship faster.</p>
      </div>

      <NewProjectButton variant="card" />

      <div className="flex flex-wrap items-start justify-center gap-x-10 gap-y-4">
        {HINTS.map((h) => (
          <div key={h.title} className="flex max-w-[160px] flex-col items-center gap-1 text-center">
            <span className={`text-lg ${h.color}`}>{h.icon}</span>
            <span className="font-mono text-[12px] font-medium text-foreground">{h.title}</span>
            <span className="font-mono text-[11px] leading-snug text-muted">{h.desc}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
