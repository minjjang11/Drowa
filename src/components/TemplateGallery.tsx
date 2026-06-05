"use client";

import { useMemo, useState } from "react";
import { createProjectFromTemplate } from "@/app/actions";
import {
  GALLERY_FILTERS,
  PAGE_TEMPLATES,
  categoryLabel,
  type GalleryCategory,
} from "@/lib/pageTemplates";

type Filter = GalleryCategory | "all";
type Sort = "new" | "popular";

export function TemplateGallery() {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("new");

  const items = useMemo(() => {
    const list = PAGE_TEMPLATES.filter((t) => filter === "all" || t.category === filter);
    // "New" = authored order; "Popular" = popularity desc.
    return sort === "popular" ? [...list].sort((a, b) => b.popularity - a.popularity) : list;
  }, [filter, sort]);

  return (
    <section id="gallery" className="mx-auto max-w-6xl px-6 pb-24 pt-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted">
          Templates &amp; Inspiration
        </h2>
        <div className="flex items-center gap-1 rounded-[6px] border border-border bg-background p-0.5">
          {(["new", "popular"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`rounded-[4px] px-2.5 py-1 font-mono text-[10px] capitalize transition-colors duration-150 ${
                sort === s ? "bg-surface-elevated text-accent" : "text-muted hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        {GALLERY_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-[9999px] px-3 py-1 font-mono text-[11px] transition-colors duration-150 ${
              filter === f.id
                ? "bg-accent text-white"
                : "border border-border text-muted hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Masonry */}
      <div className="columns-1 [column-gap:16px] sm:columns-2 lg:columns-3">
        {items.map((t) => (
          <form
            key={t.id}
            action={createProjectFromTemplate}
            className="mb-4 break-inside-avoid"
          >
            <input type="hidden" name="templateId" value={t.id} />
            <button
              type="submit"
              className="group block w-full overflow-hidden rounded-[12px] border border-border bg-surface text-left transition-all duration-150 hover:border-accent hover:shadow-[0_0_0_1px_#f59e0b,0_8px_24px_rgba(245,158,11,0.12)]"
            >
              {/* Thumbnail */}
              <div className="relative flex h-40 items-center justify-center bg-gradient-to-br from-[#1a1a1a] via-[#141414] to-[#0d0d0d]">
                <span className="serif text-2xl italic text-muted/40">{t.name}</span>
                <span className="absolute right-2 top-2 rounded-[9999px] border border-border bg-background/70 px-2 py-0.5 font-mono text-[9px] text-muted">
                  {categoryLabel(t.category)}
                </span>
                <span className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-center bg-accent py-2 font-mono text-[11px] font-medium text-white transition-transform duration-150 group-hover:translate-y-0">
                  Use this →
                </span>
              </div>
              {/* Meta */}
              <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                <span className="font-sans text-[13px] text-foreground">{t.name}</span>
                <div className="flex gap-1">
                  {(t.tags ?? []).slice(0, 1).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-[3px] border border-border px-1.5 py-0.5 font-mono text-[9px] text-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          </form>
        ))}
      </div>
    </section>
  );
}
