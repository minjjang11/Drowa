import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Workspace } from "@/components/Workspace";
import type { ChatMessage } from "@/components/ChatPanel";
import type { FileRow, Message, Overrides, Project } from "@/lib/types";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const [{ data: file }, { data: overridesFile }, { data: context }, { data: messages }] =
    await Promise.all([
      supabase
        .from("files")
        .select("*")
        .eq("project_id", id)
        .eq("path", "App.tsx")
        .maybeSingle(),
      supabase
        .from("files")
        .select("content")
        .eq("project_id", id)
        .eq("path", "overrides.json")
        .maybeSingle(),
      supabase
        .from("context_md")
        .select("content, updated_at")
        .eq("project_id", id)
        .maybeSingle(),
      supabase
        .from("messages")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: true }),
    ]);

  let initialOverrides: Overrides = {};
  try {
    initialOverrides = JSON.parse((overridesFile as { content: string } | null)?.content ?? "{}");
  } catch {
    initialOverrides = {};
  }

  const toChat = (rows: Message[], role: string): ChatMessage[] =>
    rows
      .filter((m) => m.role === role)
      .map((m) => ({
        sender: (m.user_id ? "user" : "ai") as "user" | "ai",
        content: m.content,
      }));

  const all = (messages as Message[] | null) ?? [];

  return (
    <Workspace
      projectId={id}
      projectName={(project as Project).name}
      initialCode={(file as FileRow | null)?.content ?? ""}
      initialOverrides={initialOverrides}
      initialContextMd={(context as { content: string } | null)?.content ?? ""}
      initialContextUpdatedAt={(context as { updated_at: string } | null)?.updated_at ?? null}
      initialDev={toChat(all, "dev_ai")}
      initialDesign={toChat(all, "design_ai")}
    />
  );
}
