// Phase 3-8 — server-side snapshot helpers. Pass a request-scoped Supabase
// client (RLS already scopes everything to project members).
import type { SupabaseClient } from "@supabase/supabase-js";
import { autoLabel } from "./versionMeta";
import type { VersionSnapshot, VersionTrigger } from "./types";

/** Keep at most this many versions per project. */
export const VERSION_LIMIT = 50;

/** Read the full project state (all files + context.md) into a snapshot blob. */
export async function captureSnapshot(
  supabase: SupabaseClient,
  projectId: string,
): Promise<VersionSnapshot> {
  const [{ data: files }, { data: ctx }] = await Promise.all([
    supabase.from("files").select("path, content").eq("project_id", projectId),
    supabase.from("context_md").select("content").eq("project_id", projectId).maybeSingle(),
  ]);
  return {
    files: (files as { path: string; content: string }[] | null) ?? [],
    context_md: (ctx as { content: string } | null)?.content ?? "",
  };
}

/**
 * Snapshot the project. `label` null → an auto-label is generated from the
 * trigger. Enforces the 50-version cap afterward (oldest auto-snapshots first;
 * manual versions are never auto-deleted).
 */
export async function snapshotProject(
  supabase: SupabaseClient,
  projectId: string,
  userId: string | null,
  label: string | null,
  trigger: VersionTrigger,
): Promise<void> {
  const snapshot = await captureSnapshot(supabase, projectId);
  await supabase.from("versions").insert({
    project_id: projectId,
    label: label?.trim() || autoLabel(trigger),
    snapshot,
    created_by: userId,
    trigger,
  });
  await enforceLimit(supabase, projectId);
}

/** Trim to VERSION_LIMIT by deleting the oldest non-manual snapshots. */
async function enforceLimit(supabase: SupabaseClient, projectId: string): Promise<void> {
  const { data } = await supabase
    .from("versions")
    .select("id, trigger, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const rows = (data as { id: string; trigger: VersionTrigger }[] | null) ?? [];
  const over = rows.length - VERSION_LIMIT;
  if (over <= 0) return;

  // rows are newest→oldest; reverse the autos to get oldest-first, drop `over`.
  const autosOldestFirst = rows.filter((r) => r.trigger !== "manual").reverse();
  const toDelete = autosOldestFirst.slice(0, over).map((r) => r.id);
  if (toDelete.length) await supabase.from("versions").delete().in("id", toDelete);
}
