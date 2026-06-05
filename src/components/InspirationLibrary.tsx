"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CURATED,
  PATTERN_LABEL,
  PATTERN_PREVIEW,
  type Inspiration,
  type PatternType,
} from "@/lib/inspirations";

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/** CSS-rendered preview tile (no screenshots needed for curated patterns). */
function PreviewTile({ insp }: { insp: Inspiration }) {
  if (insp.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={insp.imageUrl} alt={insp.title} className="h-28 w-full object-cover" />;
  }
  const cls = PATTERN_PREVIEW[insp.patternType];
  return (
    <div className={`h-28 w-full ${cls}`}>
      {insp.patternType === "bento_grid" && (
        <>
          <div className="col-span-2 row-span-2" />
          <div /> <div /> <div /> <div />
        </>
      )}
      {insp.patternType === "layered_cards" && (
        <div className="relative h-full">
          <div className="absolute left-6 top-5 h-16 w-28 rounded-[4px] bg-[#ec4899]/30" />
          <div className="absolute left-8 top-7 h-16 w-28 rounded-[4px] border border-[#2a2a2a] bg-[#1a1a1a]" />
        </div>
      )}
      {insp.patternType === "editorial" && (
        <span className="px-4 text-center text-lg italic text-[#f5f5f0]" style={{ fontFamily: "'Playfair Display', serif" }}>
          Aa
        </span>
      )}
      {insp.patternType === "minimal" && <div className="h-2 w-10 rounded-full bg-[#f59e0b]" />}
      {insp.patternType === "bold_type" && (
        <span className="text-3xl font-bold tracking-tight text-[#f5f5f0]">Type</span>
      )}
    </div>
  );
}

export function InspirationLibrary({
  onApply,
  onMatchStyle,
  onClose,
}: {
  onApply: (insp: Inspiration) => void;
  onMatchStyle: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"curated" | "saved">("curated");
  const [saved, setSaved] = useState<Inspiration[]>([]);
  const matchInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);

  async function loadSaved() {
    const supabase = createClient();
    const { data } = await supabase
      .from("inspirations")
      .select("id, title, image_url, tags, pattern_type")
      .eq("is_curated", false)
      .order("created_at", { ascending: false });
    if (data) {
      setSaved(
        data.map((r) => ({
          id: r.id as string,
          title: r.title as string,
          imageUrl: r.image_url as string | undefined,
          tags: (r.tags as string[]) ?? [],
          patternType: r.pattern_type as PatternType,
          description: "",
        })),
      );
    }
  }

  useEffect(() => {
    loadSaved();
  }, []);

  async function bookmark(insp: Inspiration) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("inspirations").insert({
      owner_id: user.id,
      title: insp.title,
      image_url: insp.imageUrl ?? null,
      tags: insp.tags,
      pattern_type: insp.patternType,
      is_curated: false,
    });
    loadSaved();
  }

  async function uploadSaved(file: File) {
    const dataUrl = await readAsDataURL(file);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const title = window.prompt("Title for this reference?", file.name) ?? file.name;
    const tagsRaw = window.prompt("Tags? (comma-separated)", "reference") ?? "";
    await supabase.from("inspirations").insert({
      owner_id: user.id,
      title,
      image_url: dataUrl,
      tags: tagsRaw.split(",").map((t) => t.trim()).filter(Boolean),
      pattern_type: "minimal",
      is_curated: false,
    });
    loadSaved();
  }

  const shown = tab === "curated" ? CURATED : saved;

  return (
    <div className="liquid-glass-strong anim-modal fixed inset-0 z-50 flex flex-col duration-200">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-5">
        <div className="flex items-center gap-4">
          <span className="serif text-lg italic text-foreground">Inspiration</span>
          <div className="flex gap-1">
            {(["curated", "saved"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-[4px] px-2.5 py-1 font-mono text-[11px] capitalize transition-colors ${
                  tab === t ? "bg-surface-elevated text-accent" : "text-muted hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => matchInput.current?.click()}
            className="btn-grad rounded-[4px] px-3 py-1.5 font-mono text-[11px] text-foreground"
          >
            🎨 Match this style
          </button>
          <button onClick={onClose} className="font-mono text-[11px] text-muted hover:text-foreground">
            ✕
          </button>
        </div>
        <input
          ref={matchInput}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) onMatchStyle(await readAsDataURL(f));
          }}
        />
      </div>

      {/* Masonry grid */}
      <div className="flex-1 overflow-y-auto p-5">
        {tab === "saved" && (
          <button
            onClick={() => uploadInput.current?.click()}
            className="glow-hover mb-4 w-full rounded-[8px] border border-dashed border-[#3a3a30] py-4 font-mono text-[11px] text-muted transition-colors hover:border-accent"
          >
            + Upload a reference image
          </button>
        )}
        <input
          ref={uploadInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadSaved(f);
          }}
        />

        {shown.length === 0 ? (
          <p className="py-12 text-center font-mono text-[11px] text-muted">
            {tab === "saved" ? "No saved references yet." : "Nothing here."}
          </p>
        ) : (
          <div className="columns-2 gap-4 md:columns-3 lg:columns-4 [&>*]:mb-4">
            {shown.map((insp) => (
              <div
                key={insp.id}
                className="glow-hover group break-inside-avoid overflow-hidden rounded-[8px] border border-border bg-surface transition-colors hover:border-accent"
              >
                <PreviewTile insp={insp} />
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[12px] text-foreground">{insp.title}</span>
                    {tab === "curated" && (
                      <button
                        onClick={() => bookmark(insp)}
                        title="Save"
                        className="shrink-0 text-sm text-muted hover:text-accent"
                      >
                        ⌖
                      </button>
                    )}
                  </div>
                  <span className="mt-1 inline-block font-mono text-[10px] text-accent-2">
                    {PATTERN_LABEL[insp.patternType]}
                  </span>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {insp.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-[3px] border border-border bg-background px-1.5 py-0.5 font-mono text-[9px] text-muted"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => onApply(insp)}
                    className="mt-3 w-full rounded-[4px] bg-accent py-1.5 font-mono text-[11px] font-medium text-white transition-opacity hover:opacity-90"
                  >
                    Apply Style
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
