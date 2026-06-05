"use client";

import type { Selection, StyleMap } from "@/lib/types";

function toHex(value: string): string {
  if (!value) return "#000000";
  if (value.startsWith("#")) return value.slice(0, 7);
  const m = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return "#000000";
  const h = (n: string) => Number(n).toString(16).padStart(2, "0");
  return `#${h(m[1])}${h(m[2])}${h(m[3])}`;
}

const px = (v: string) => (v || "").replace("px", "").trim();

function parseTranslate(t?: string): { x: number; y: number } {
  const m = /translate\(([-0-9.]+)px,\s*([-0-9.]+)px\)/.exec(t || "");
  return { x: m ? parseFloat(m[1]) : 0, y: m ? parseFloat(m[2]) : 0 };
}

const numInput =
  "input-dark h-7 w-full rounded-[3px] px-1.5 text-center font-mono text-[11px]";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border px-3 py-3">
      <div className="serif mb-2 text-[13px] italic text-accent">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-12 shrink-0 font-mono text-[11px] text-muted">{label}</label>
      {children}
    </div>
  );
}

export function PropertyPanel({
  selection,
  transform,
  onChange,
  onSelectPath,
}: {
  selection: Selection | null;
  transform?: string;
  onChange: (style: StyleMap) => void;
  /** Jump selection to an ancestor when a breadcrumb crumb is clicked (3-7 §6). */
  onSelectPath?: (id: string) => void;
}) {
  const open = !!selection;
  const s = selection?.styles ?? {};
  const pos = parseTranslate(transform);
  const path = selection?.path ?? [];

  const sides = (group: "padding" | "margin") =>
    (["Top", "Right", "Bottom", "Left"] as const).map((side) => (
      <input
        key={side}
        type="text"
        inputMode="numeric"
        title={`${group}-${side.toLowerCase()}`}
        defaultValue={px(s[`${group}${side}`])}
        onBlur={(e) => onChange({ [`${group}${side}`]: `${e.target.value || 0}px` })}
        className={numInput}
      />
    ));

  return (
    <div
      className={`grad-border absolute right-0 top-0 z-10 flex h-full w-60 flex-col bg-surface shadow-[-4px_0_24px_rgba(0,0,0,0.5)] transition-transform duration-[250ms] ease-out ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
        <span className="font-mono text-[11px] text-accent">
          &lt;{selection?.tag}&gt;
        </span>
        {selection?.line ? (
          <span className="font-mono text-[10px] text-muted">L{selection.line}</span>
        ) : null}
      </div>

      {/* Breadcrumb: div › section › div › button — click a crumb to select it. */}
      {path.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 border-b border-border px-3 py-2 font-mono text-[10px] text-muted">
          {path.map((node, i) => {
            const active = node.id === selection?.id;
            return (
              <span key={node.id} className="flex items-center gap-1">
                <button
                  onClick={() => onSelectPath?.(node.id)}
                  className={`transition-colors hover:text-accent ${active ? "text-accent" : "text-muted"}`}
                >
                  {node.tag}
                </button>
                {i < path.length - 1 && <span className="text-muted/50">›</span>}
              </span>
            );
          })}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <Section title="Typography">
          <Field label="size">
            <input
              type="text"
              inputMode="numeric"
              defaultValue={px(s.fontSize)}
              key={`size-${selection?.id}`}
              onBlur={(e) => onChange({ fontSize: `${e.target.value || 16}px` })}
              className={`${numInput} w-14`}
            />
          </Field>
          <Field label="font">
            <input
              type="text"
              defaultValue={s.fontFamily?.split(",")[0]?.replace(/["']/g, "")}
              key={`font-${selection?.id}`}
              onBlur={(e) => e.target.value && onChange({ fontFamily: e.target.value })}
              className={`${numInput} px-2 text-left`}
            />
          </Field>
        </Section>

        <Section title="Colors">
          <Field label="text">
            <span className="grad-border rounded-[4px] p-0.5">
              <input
                type="color"
                value={toHex(s.color)}
                onChange={(e) => onChange({ color: e.target.value })}
                className="block h-6 w-6 cursor-pointer rounded-[2px] border-0 bg-transparent p-0"
              />
            </span>
            <span className="font-mono text-[10px] text-muted">{toHex(s.color)}</span>
          </Field>
          <Field label="bg">
            <span className="grad-border rounded-[4px] p-0.5">
              <input
                type="color"
                value={toHex(s.backgroundColor)}
                onChange={(e) => onChange({ backgroundColor: e.target.value })}
                className="block h-6 w-6 cursor-pointer rounded-[2px] border-0 bg-transparent p-0"
              />
            </span>
            <span className="font-mono text-[10px] text-muted">{toHex(s.backgroundColor)}</span>
          </Field>
        </Section>

        <Section title="Spacing">
          <Field label="pad">
            <div className="grid grid-cols-4 gap-1">{sides("padding")}</div>
          </Field>
          <Field label="margin">
            <div className="grid grid-cols-4 gap-1">{sides("margin")}</div>
          </Field>
        </Section>

        <Section title="Position">
          <Field label="x">
            <input
              type="text"
              inputMode="numeric"
              defaultValue={pos.x}
              key={`x-${selection?.id}-${pos.x}`}
              onBlur={(e) =>
                onChange({ transform: `translate(${e.target.value || 0}px, ${pos.y}px)` })
              }
              className={`${numInput} w-16`}
            />
          </Field>
          <Field label="y">
            <input
              type="text"
              inputMode="numeric"
              defaultValue={pos.y}
              key={`y-${selection?.id}-${pos.y}`}
              onBlur={(e) =>
                onChange({ transform: `translate(${pos.x}px, ${e.target.value || 0}px)` })
              }
              className={`${numInput} w-16`}
            />
          </Field>
        </Section>
      </div>
    </div>
  );
}
