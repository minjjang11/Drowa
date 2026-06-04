"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BUILTIN_TEMPLATES,
  CATEGORIES,
  type Template,
  type TemplateCategory,
} from "@/lib/templates";

type Tab = TemplateCategory | "mine";

const GLYPH: Record<TemplateCategory, string> = {
  hero: "▭",
  cards: "▦",
  pricing: "▤",
  forms: "⊟",
  nav: "▬",
  dashboard: "◫",
  footer: "▁",
};

export function TemplateLibrary({
  onInsert,
  onClose,
}: {
  onInsert: (t: Template) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("hero");
  const [mine, setMine] = useState<Template[]>([]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("templates")
        .select("id, name, category, code")
        .eq("is_global", false)
        .order("created_at", { ascending: false });
      if (data) setMine(data as Template[]);
    })();
  }, []);

  const shown =
    tab === "mine" ? mine : BUILTIN_TEMPLATES.filter((t) => t.category === tab);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="grad-border flex h-full w-[420px] flex-col bg-surface shadow-[-4px_0_24px_rgba(0,0,0,0.5)] duration-200"
      >
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
          <span className="serif text-base italic text-foreground">Templates</span>
          <button onClick={onClose} className="font-mono text-[11px] text-muted hover:text-foreground">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 flex-wrap gap-1 border-b border-border px-3 py-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setTab(c.id)}
              className={`rounded-[4px] px-2 py-1 font-mono text-[11px] transition-colors ${
                tab === c.id ? "bg-surface-elevated text-accent" : "text-muted hover:text-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
          <button
            onClick={() => setTab("mine")}
            className={`rounded-[4px] px-2 py-1 font-mono text-[11px] transition-colors ${
              tab === "mine" ? "bg-surface-elevated text-accent-2" : "text-muted hover:text-foreground"
            }`}
          >
            My Templates
          </button>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-3">
          {shown.length === 0 && (
            <p className="col-span-2 py-8 text-center font-mono text-[11px] text-muted">
              {tab === "mine" ? "No saved templates yet." : "Nothing here."}
            </p>
          )}
          {shown.map((t) => (
            <div
              key={t.id}
              className="glow-hover group flex flex-col overflow-hidden rounded-[8px] border border-border bg-background transition-colors hover:border-accent"
            >
              <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] text-2xl text-muted">
                {GLYPH[(t.category as TemplateCategory)] ?? "▭"}
              </div>
              <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                <span className="truncate text-[12px] text-foreground">{t.name}</span>
                <button
                  onClick={() => onInsert(t)}
                  className="btn-grad shrink-0 rounded-[4px] px-2 py-0.5 font-mono text-[10px] text-foreground"
                >
                  + Insert
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
