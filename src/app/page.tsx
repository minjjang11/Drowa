import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createProject, signOut } from "./actions";
import type { Project } from "@/lib/types";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Drowa</h1>
          <p className="font-mono text-xs text-muted">{user.email}</p>
        </div>
        <form action={signOut}>
          <button className="rounded-[4px] border border-border bg-surface px-3 py-1.5 font-mono text-xs text-muted transition-colors duration-150 hover:text-foreground">
            Sign out
          </button>
        </form>
      </header>

      <form action={createProject} className="mb-8 flex gap-2">
        <input
          name="name"
          required
          placeholder="New project name"
          className="flex-1 rounded-[4px] border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 placeholder:text-muted focus:border-accent"
        />
        <button className="rounded-[4px] bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90">
          Create
        </button>
      </form>

      <div className="grid gap-2">
        {(projects as Project[] | null)?.map((p) => (
          <Link
            key={p.id}
            href={`/project/${p.id}`}
            className="rounded-[4px] border border-border bg-surface px-4 py-3 transition-colors duration-150 hover:border-accent"
          >
            <div className="text-sm font-medium">{p.name}</div>
            <div className="font-mono text-[11px] text-muted">
              updated {new Date(p.updated_at).toLocaleString()}
            </div>
          </Link>
        ))}
        {projects?.length === 0 && (
          <p className="font-mono text-xs text-muted">No projects yet. Create one above.</p>
        )}
      </div>
    </div>
  );
}
