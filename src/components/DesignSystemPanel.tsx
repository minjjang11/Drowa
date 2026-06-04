"use client";

import type { DesignTokens } from "@/lib/types";

const COLOR_LABELS: Record<keyof DesignTokens["colors"], string> = {
  background: "Background",
  surface: "Surface",
  surfaceElevated: "Surface Elevated",
  border: "Border",
  accentPrimary: "Accent Primary",
  accentSecondary: "Accent Secondary",
  textPrimary: "Text Primary",
  textSecondary: "Text Secondary",
  error: "Error",
  success: "Success",
};

const textInput = "input-dark h-7 rounded-[3px] px-2 font-mono text-[11px]";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border px-4 py-4">
      <div className="serif mb-3 text-[14px] italic text-accent">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="font-mono text-[11px] text-muted">{label}</label>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export function DesignSystemPanel({
  tokens,
  onChange,
  onClose,
}: {
  tokens: DesignTokens;
  onChange: (next: DesignTokens) => void;
  onClose: () => void;
}) {
  const setColor = (k: keyof DesignTokens["colors"], v: string) =>
    onChange({ ...tokens, colors: { ...tokens.colors, [k]: v } });
  const setType = (k: keyof DesignTokens["typography"], v: string) =>
    onChange({ ...tokens, typography: { ...tokens.typography, [k]: v } });
  const setRadius = (k: keyof DesignTokens["radius"], v: string) =>
    onChange({ ...tokens, radius: { ...tokens.radius, [k]: v } });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="grad-border flex h-full w-80 flex-col bg-surface shadow-[-4px_0_24px_rgba(0,0,0,0.5)]"
      >
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
          <span className="serif text-base italic text-foreground">Design System</span>
          <button
            onClick={onClose}
            className="font-mono text-[11px] text-muted transition-colors hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Section title="Colors">
            {(Object.keys(COLOR_LABELS) as (keyof DesignTokens["colors"])[]).map((k) => (
              <Row key={k} label={COLOR_LABELS[k]}>
                <input
                  type="color"
                  value={tokens.colors[k]}
                  onChange={(e) => setColor(k, e.target.value)}
                  className="h-6 w-6 cursor-pointer rounded-[3px] border border-border bg-transparent p-0"
                />
                <input
                  type="text"
                  value={tokens.colors[k]}
                  onChange={(e) => setColor(k, e.target.value)}
                  className={`${textInput} w-20`}
                />
              </Row>
            ))}
          </Section>

          <Section title="Typography">
            <Row label="Display">
              <input value={tokens.typography.fontDisplay} onChange={(e) => setType("fontDisplay", e.target.value)} className={`${textInput} w-36`} />
            </Row>
            <Row label="UI">
              <input value={tokens.typography.fontUI} onChange={(e) => setType("fontUI", e.target.value)} className={`${textInput} w-36`} />
            </Row>
            <Row label="Mono">
              <input value={tokens.typography.fontMono} onChange={(e) => setType("fontMono", e.target.value)} className={`${textInput} w-36`} />
            </Row>
            <Row label="Base size">
              <input value={tokens.typography.scaleBase} onChange={(e) => setType("scaleBase", e.target.value)} className={`${textInput} w-20`} />
            </Row>
            <Row label="Scale ratio">
              <input value={tokens.typography.scaleRatio} onChange={(e) => setType("scaleRatio", e.target.value)} className={`${textInput} w-20`} />
            </Row>
          </Section>

          <Section title="Spacing">
            <Row label="Unit">
              <input
                value={tokens.spacing.unit}
                onChange={(e) => onChange({ ...tokens, spacing: { ...tokens.spacing, unit: e.target.value } })}
                className={`${textInput} w-20`}
              />
            </Row>
            <Row label="Scale">
              <input
                value={tokens.spacing.scale.join(", ")}
                onChange={(e) =>
                  onChange({
                    ...tokens,
                    spacing: {
                      ...tokens.spacing,
                      scale: e.target.value
                        .split(",")
                        .map((n) => parseInt(n.trim(), 10))
                        .filter((n) => !Number.isNaN(n)),
                    },
                  })
                }
                className={`${textInput} w-44`}
              />
            </Row>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {tokens.spacing.scale.map((n, i) => (
                <span
                  key={i}
                  className="rounded-[3px] border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted"
                >
                  {n}
                </span>
              ))}
            </div>
          </Section>

          <Section title="Radius">
            {(["sm", "md", "lg", "full"] as const).map((k) => (
              <Row key={k} label={k}>
                <input value={tokens.radius[k]} onChange={(e) => setRadius(k, e.target.value)} className={`${textInput} w-20`} />
              </Row>
            ))}
          </Section>

          <p className="px-4 py-3 font-mono text-[10px] leading-relaxed text-muted">
            Every AI generation follows these tokens. Edits auto-save and sync to context.md.
          </p>
        </div>
      </div>
    </div>
  );
}
