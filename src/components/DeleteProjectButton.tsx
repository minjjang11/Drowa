"use client";

import { deleteProject } from "@/app/actions";

// Small ✕ on a project card. Confirms, then deletes from Drowa only.
export function DeleteProjectButton({ projectId, name }: { projectId: string; name: string }) {
  return (
    <form
      action={deleteProject}
      onSubmit={(e) => {
        if (
          !confirm(
            `Delete "${name}"?\n\nThis removes it from Drowa only — your GitHub repo (if any) is NOT touched. This cannot be undone.`,
          )
        ) {
          e.preventDefault();
        }
      }}
      className="absolute right-2 top-2 z-10"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <button
        type="submit"
        title="Delete project"
        className="flex h-6 w-6 items-center justify-center rounded-[6px] border border-border bg-surface font-mono text-[12px] text-muted opacity-0 transition-all hover:border-error hover:text-error group-hover:opacity-100"
      >
        ✕
      </button>
    </form>
  );
}
