"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const STARTER_APP = `export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-800">Hello from Drowa</h1>
        <p className="mt-2 text-slate-500">Ask your AI to change something.</p>
      </div>
    </div>
  );
}`;

export async function createProject(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project, error } = await supabase
    .from("projects")
    .insert({ name, owner_id: user.id })
    .select()
    .single();

  if (error || !project) {
    throw new Error(error?.message ?? "Failed to create project");
  }

  // Seed an initial preview file. context_md row is created by the DB trigger.
  await supabase.from("files").insert({
    project_id: project.id,
    path: "App.tsx",
    content: STARTER_APP,
  });

  revalidatePath("/");
  redirect(`/project/${project.id}`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
