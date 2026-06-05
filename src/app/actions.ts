"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TOKENS } from "@/lib/types";
import { PAGE_TEMPLATES } from "@/lib/pageTemplates";

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

  // Seed the design system with defaults (Phase 3-1).
  await supabase.from("design_tokens").insert({
    project_id: project.id,
    tokens: DEFAULT_TOKENS,
  });

  revalidatePath("/");
  redirect(`/project/${project.id}`);
}

/** Shared bootstrap: create a project + seed App.tsx + design tokens. Returns id. */
async function bootstrapProject(name: string, appCode: string): Promise<string> {
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
  if (error || !project) throw new Error(error?.message ?? "Failed to create project");

  await supabase.from("files").insert({ project_id: project.id, path: "App.tsx", content: appCode });
  await supabase.from("design_tokens").insert({ project_id: project.id, tokens: DEFAULT_TOKENS });
  return project.id as string;
}

/** Home hero "Start from Scratch": name = prompt, redirect with ?seed so the
 *  workspace fires the first AI generation immediately. */
export async function createProjectFromPrompt(formData: FormData) {
  const prompt = String(formData.get("prompt") ?? "").trim();
  if (!prompt) return;
  const name = prompt.length > 60 ? `${prompt.slice(0, 57)}…` : prompt;
  const id = await bootstrapProject(name, STARTER_APP);
  revalidatePath("/");
  redirect(`/project/${id}?seed=${encodeURIComponent(prompt)}`);
}

/** Gallery "Use this": create a project with the template pre-loaded. No AI. */
export async function createProjectFromTemplate(formData: FormData) {
  const templateId = String(formData.get("templateId") ?? "");
  const tpl = PAGE_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl) return;
  const id = await bootstrapProject(tpl.name, tpl.code);
  revalidatePath("/");
  redirect(`/project/${id}`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
