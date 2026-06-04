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
          <h1 className="text-2xl font-bold">Drowa</h1>
          <p className="text-sm text-white/50">{user.email}</p>
        </div>
        <form action={signOut}>
          <button className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-white/60 hover:bg-white/5">
            Sign out
          </button>
        </form>
      </header>

      <form action={createProject} className="mb-8 flex gap-2">
        <input
          name="name"
          required
          placeholder="New project name"
          className="flex-1 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/30"
        />
        <button className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium hover:bg-indigo-400">
          Create
        </button>
      </form>

      <div className="grid gap-3">
        {(projects as Project[] | null)?.map((p) => (
          <Link
            key={p.id}
            href={`/project/${p.id}`}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10"
          >
            <div className="font-medium">{p.name}</div>
            <div className="text-xs text-white/40">
              updated {new Date(p.updated_at).toLocaleString()}
            </div>
          </Link>
        ))}
        {projects?.length === 0 && (
          <p className="text-sm text-white/40">No projects yet. Create one above.</p>
        )}
      </div>
    </div>
  );
}
