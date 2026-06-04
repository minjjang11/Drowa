"use client";

import { useState } from "react";
import { createProject } from "@/app/actions";

/** Renders either a dashed empty-state card or a toolbar button, both opening a name modal. */
export function NewProjectButton({ variant }: { variant: "card" | "button" }) {
  const [open, setOpen] = useState(false);

  const trigger =
    variant === "card" ? (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full max-w-md flex-col items-center justify-center gap-2 rounded-[8px] border border-dashed border-[#c0c0c0] bg-surface px-6 py-10 transition-colors duration-150 hover:border-accent"
      >
        <span className="text-2xl text-muted">+</span>
        <span className="text-sm font-medium">New Project</span>
      </button>
    ) : (
      <button
        onClick={() => setOpen(true)}
        className="rounded-[4px] bg-accent px-3 py-1.5 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90"
      >
        + New Project
      </button>
    );

  return (
    <>
      {trigger}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4"
          onClick={() => setOpen(false)}
        >
          <form
            action={createProject}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm space-y-4 rounded-[8px] border border-border bg-surface p-6 shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
          >
            <div>
              <h2 className="text-base font-semibold">New Project</h2>
              <p className="font-mono text-[11px] text-muted">Give it a name to get started.</p>
            </div>
            <input
              name="name"
              autoFocus
              required
              placeholder="project name"
              className="w-full rounded-[4px] border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 placeholder:text-muted focus:border-accent"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-[4px] border border-border bg-surface px-3 py-1.5 font-mono text-[12px] text-muted transition-colors duration-150 hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-[4px] bg-accent px-3 py-1.5 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
