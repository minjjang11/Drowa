"use client";

import { useEffect, useRef, useState } from "react";

const LH = 20; // line-height in px — shared by gutter, highlight band, and editor.

/**
 * Phase 3-7 §4 — code panel synced to the visual selection.
 *
 * No Monaco dependency in this project, so this is a lightweight editor: a
 * monospace <textarea> sized to its content (the wrapper scrolls, not the
 * textarea) layered over a line-number gutter and an amber active-line band.
 * Manual edits autosave on a 500ms debounce and on blur.
 */
export function CodePanel({
  code,
  activeLine,
  editable,
  onChange,
}: {
  code: string;
  /** 1-based source line to highlight + scroll to, or 0/undefined for none. */
  activeLine?: number;
  editable: boolean;
  onChange?: (next: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draft, setDraft] = useState(code);

  // External code changes (AI gen, partner sync, duplicate/delete) win.
  useEffect(() => setDraft(code), [code]);

  // Scroll the highlighted line into view when the selection moves.
  useEffect(() => {
    if (activeLine && scrollRef.current) {
      scrollRef.current.scrollTo({ top: Math.max(0, (activeLine - 1) * LH - 80), behavior: "smooth" });
    }
  }, [activeLine]);

  const lines = draft.split("\n");

  function commit(next: string) {
    if (next !== code) onChange?.(next);
  }

  function handleChange(next: string) {
    setDraft(next);
    if (!editable) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => commit(next), 500);
  }

  function handleBlur() {
    if (!editable) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    commit(draft);
  }

  return (
    <div ref={scrollRef} className="relative flex-1 overflow-auto bg-surface">
      <div className="relative" style={{ height: lines.length * LH + 32 }}>
        {/* active-line band */}
        {activeLine ? (
          <div
            className="pointer-events-none absolute inset-x-0 border-l-2 border-accent bg-accent/10"
            style={{ top: (activeLine - 1) * LH + 16, height: LH }}
          />
        ) : null}

        <div className="flex">
          {/* gutter */}
          <div
            aria-hidden
            className="select-none px-2 pt-4 text-right font-mono text-[12px] text-muted/50"
            style={{ lineHeight: `${LH}px` }}
          >
            {lines.map((_, i) => (
              <div key={i} className={activeLine === i + 1 ? "text-accent" : undefined}>
                {i + 1}
              </div>
            ))}
          </div>

          {/* editor / viewer */}
          <textarea
            value={draft}
            readOnly={!editable}
            spellCheck={false}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            wrap="off"
            className="flex-1 resize-none border-0 bg-transparent px-3 pt-4 font-mono text-[12px] text-foreground outline-none"
            style={{ lineHeight: `${LH}px`, height: lines.length * LH + 16, overflow: "hidden" }}
          />
        </div>
      </div>
    </div>
  );
}
