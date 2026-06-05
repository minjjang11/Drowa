"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { createProjectFromPrompt } from "@/app/actions";
import { NewProjectButton } from "./NewProjectButton";

const PLACEHOLDERS = [
  "A SaaS landing page with dark mode…",
  "A dashboard for tracking analytics…",
  "A portfolio with bento grid layout…",
  "A waitlist page for my startup…",
];

type Tab = "scratch" | "github" | "template";

const TABS: { id: Tab; label: string }[] = [
  { id: "scratch", label: "✦ Start from Scratch" },
  { id: "github", label: "⎘ Import from GitHub" },
  { id: "template", label: "⊞ Use Template" },
];

function SubmitArrow() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Start building"
      className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[8px] bg-accent text-[#0d0d0d] transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "…" : "→"}
    </button>
  );
}

export function HomeHero() {
  const [tab, setTab] = useState<Tab>("scratch");
  const [ph, setPh] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setPh((n) => (n + 1) % PLACEHOLDERS.length), 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="px-6 py-16 text-center">
      <h1 className="serif text-4xl italic text-foreground sm:text-5xl">
        What are you building today?
      </h1>

      <div className="mx-auto mt-8 max-w-[680px]">
        {/* Tabs */}
        <div className="mb-3 flex flex-wrap justify-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-[9999px] px-3.5 py-1.5 font-mono text-[11px] transition-colors duration-150 ${
                tab === t.id
                  ? "bg-accent text-[#0d0d0d]"
                  : "border border-border text-muted hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "scratch" && (
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
        )}

        {tab === "github" && (
          <div className="grad-border flex items-center justify-center rounded-[12px] bg-surface px-4 py-6">
            <NewProjectButton variant="button" label="⎘ Import from GitHub" initialTab="github" />
          </div>
        )}

        {tab === "template" && (
          <div className="grad-border flex items-center justify-center rounded-[12px] bg-surface px-4 py-6">
            <button
              onClick={() => document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" })}
              className="btn-grad rounded-[8px] px-4 py-2 font-mono text-[12px] font-medium text-foreground"
            >
              Browse templates ↓
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
