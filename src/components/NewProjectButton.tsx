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
        className="glow-hover flex w-full max-w-md flex-col items-center justify-center gap-2 rounded-[8px] border border-dashed border-[#3a3a30] bg-surface px-6 py-10 transition-colors duration-150 hover:border-accent"
      >
        <span className="text-2xl text-accent">+</span>
        <span className="text-sm font-medium text-foreground">New Project</span>
      </button>
    ) : (
      <button
        onClick={() => setOpen(true)}
        className="btn-grad rounded-[4px] px-3 py-1.5 text-sm font-medium text-foreground"
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
            className="grad-border w-full max-w-sm space-y-4 rounded-[8px] bg-surface p-6 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
          >
            <div>
              <h2 className="serif text-lg italic text-foreground">New Project</h2>
              <p className="font-mono text-[11px] text-muted">Give it a name to get started.</p>
            </div>
            <input
              name="name"
              autoFocus
              required
              placeholder="project name"
              className="input-dark w-full rounded-[4px] px-3 py-2 text-sm"
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
                className="btn-grad rounded-[4px] px-3 py-1.5 text-sm font-medium text-foreground"
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
