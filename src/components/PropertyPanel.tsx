"use client";

import type { Selection, StyleMap } from "@/lib/types";

/** Normalizes a computed color (rgb/rgba) to #rrggbb for <input type=color>. */
function toHex(value: string): string {
  if (!value) return "#000000";
  if (value.startsWith("#")) return value.slice(0, 7);
  const m = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return "#000000";
  const h = (n: string) => Number(n).toString(16).padStart(2, "0");
  return `#${h(m[1])}${h(m[2])}${h(m[3])}`;
}

function px(value: string): string {
  return (value || "").replace("px", "").trim();
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-14 shrink-0 font-mono text-[11px] text-muted">{label}</label>
      {children}
    </div>
  );
}

const numInput =
  "h-7 w-full rounded-[3px] border border-border bg-surface px-1.5 text-center font-mono text-[11px] outline-none focus:border-accent";

export function PropertyPanel({
  selection,
  onChange,
}: {
  selection: Selection;
  onChange: (style: StyleMap) => void;
}) {
  const s = selection.styles;

  const sides = (group: "padding" | "margin") =>
    (["Top", "Right", "Bottom", "Left"] as const).map((side) => (
      <input
        key={side}
        type="text"
        inputMode="numeric"
        title={`${group}-${side.toLowerCase()}`}
        defaultValue={px(s[`${group}${side}`])}
        onBlur={(e) =>
          onChange({ [`${group}${side}`]: `${e.target.value || 0}px` })
        }
        className={numInput}
      />
    ));

  return (
    <div className="flex flex-wrap items-start gap-x-8 gap-y-3 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-accent">
          &lt;{selection.tag}&gt;
        </span>
        <span className="font-mono text-[10px] text-muted">{selection.id}</span>
      </div>

      <Row label="color">
        <input
          type="color"
          value={toHex(s.color)}
          onChange={(e) => onChange({ color: e.target.value })}
          className="h-7 w-7 cursor-pointer rounded-[3px] border border-border bg-surface p-0.5"
        />
      </Row>

      <Row label="bg">
        <input
          type="color"
          value={toHex(s.backgroundColor)}
          onChange={(e) => onChange({ backgroundColor: e.target.value })}
          className="h-7 w-7 cursor-pointer rounded-[3px] border border-border bg-surface p-0.5"
        />
      </Row>

      <Row label="size">
        <input
          type="text"
          inputMode="numeric"
          defaultValue={px(s.fontSize)}
          onBlur={(e) => onChange({ fontSize: `${e.target.value || 16}px` })}
          className={`${numInput} w-12`}
        />
      </Row>

      <Row label="font">
        <input
          type="text"
          defaultValue={s.fontFamily?.split(",")[0]?.replace(/["']/g, "")}
          onBlur={(e) => e.target.value && onChange({ fontFamily: e.target.value })}
          className={`${numInput} w-28 text-left px-2`}
        />
      </Row>

      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 font-mono text-[11px] text-muted">pad</span>
        <div className="grid grid-cols-4 gap-1">{sides("padding")}</div>
      </div>

      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 font-mono text-[11px] text-muted">margin</span>
        <div className="grid grid-cols-4 gap-1">{sides("margin")}</div>
      </div>
    </div>
  );
}
