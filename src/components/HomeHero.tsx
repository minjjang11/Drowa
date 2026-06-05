"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { createProjectFromPrompt } from "@/app/actions";
import { NewProjectButton } from "./NewProjectButton";
import { BlurText } from "./BlurText";

const PLACEHOLDERS = [
  "A SaaS landing page with dark mode...",
  "A dashboard for tracking analytics...",
  "A portfolio with bento grid layout...",
  "A waitlist page for my startup...",
];

function SubmitArrow() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Start building"
      className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[8px] bg-accent text-white transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "..." : "->"}
    </button>
  );
}

export function HomeHero() {
  const [ph, setPh] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setPh((n) => (n + 1) % PLACEHOLDERS.length), 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="px-6 py-16 text-center">
      <h1 className="serif text-4xl text-foreground sm:text-5xl">
        <BlurText text="What are you building today?" />
      </h1>

      <div className="mx-auto mt-8 max-w-[680px]">
        <form action={createProjectFromPrompt} className="grad-border glow-hover relative rounded-[12px] bg-surface">
          <input
            name="prompt"
            autoFocus
            required
            placeholder={PLACEHOLDERS[ph]}
            className="w-full rounded-[12px] bg-transparent px-4 py-4 pr-14 font-sans text-sm text-foreground outline-none placeholder:text-muted"
          />
          <SubmitArrow />
        </form>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <NewProjectButton variant="button" label="Import from GitHub" initialTab="github" />
          <button
            onClick={() => document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" })}
            className="rounded-[6px] border border-border bg-surface px-3 py-1.5 font-mono text-[11px] text-muted transition-colors hover:border-accent hover:text-foreground"
          >
            Browse templates
          </button>
        </div>
      </div>
    </section>
  );
}
