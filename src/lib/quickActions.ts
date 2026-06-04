export type QuickActionCategory =
  | "style"
  | "responsive"
  | "mode"
  | "animation"
  | "structure"
  | "custom";

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  promptTemplate: string;
  category: QuickActionCategory;
  isGlobal?: boolean;
}

/**
 * Built-in quick actions. The chat route already injects the current file +
 * design tokens, so these prompt templates are enough on their own.
 */
export const BUILTIN_ACTIONS: QuickAction[] = [
  // ── Style ─────────────────────────────────────────────
  {
    id: "qa-premium",
    label: "Make it premium",
    icon: "✨",
    category: "style",
    promptTemplate:
      "Elevate the visual quality of the current UI. Apply refined typography hierarchy, tighter spacing, subtle depth (gradient borders, noise texture), and replace any generic elements with more considered design choices. Keep all content and functionality intact. Follow the project design system.",
  },
  {
    id: "qa-minimal",
    label: "Make it minimal",
    icon: "🎯",
    category: "style",
    promptTemplate:
      "Strip the current UI down to its essentials. Remove decorative elements, increase whitespace, reduce color usage to near-monochrome with one accent, simplify typography to one weight where possible. Keep all content and functionality intact.",
  },
  {
    id: "qa-bold",
    label: "Make it bold",
    icon: "🔥",
    category: "style",
    promptTemplate:
      "Push the visual presence of the UI. Use larger typography, stronger contrast, more prominent use of accent colors, and bolder layout decisions (full-bleed, oversized elements). Keep all content and functionality intact.",
  },
  // ── Responsive ────────────────────────────────────────
  {
    id: "qa-mobile",
    label: "Make mobile responsive",
    icon: "📱",
    category: "responsive",
    promptTemplate:
      "Make the current UI fully responsive for mobile (320px–768px). Convert multi-column layouts to single column, increase tap target sizes to min 44px, adjust typography scale for small screens, ensure no horizontal overflow. Keep desktop layout intact.",
  },
  {
    id: "qa-fullwidth",
    label: "Make it full-width",
    icon: "🖥️",
    category: "responsive",
    promptTemplate:
      "Expand the current layout to use the full viewport width. Remove max-width constraints where appropriate, use edge-to-edge sections for visual impact.",
  },
  // ── Mode ──────────────────────────────────────────────
  {
    id: "qa-dark",
    label: "Add dark mode",
    icon: "🌙",
    category: "mode",
    promptTemplate:
      "Add a dark mode variant using CSS variables or Tailwind dark: prefix. Dark palette should use the project design system dark tokens. Add a toggle button in the top-right corner.",
  },
  {
    id: "qa-light",
    label: "Switch to light mode",
    icon: "☀️",
    category: "mode",
    promptTemplate:
      "Convert the current dark UI to a clean light theme. Use the project design system light tokens. Ensure contrast ratios remain accessible.",
  },
  // ── Animation ─────────────────────────────────────────
  {
    id: "qa-entrance",
    label: "Add entrance animations",
    icon: "⚡",
    category: "animation",
    promptTemplate:
      "Add subtle entrance animations to key elements using Tailwind animate or CSS. Fade-in + slight upward translate on scroll for sections. Stagger children animations where appropriate. Keep animations under 400ms. No bouncy or excessive motion.",
  },
  {
    id: "qa-hover",
    label: "Add hover effects",
    icon: "✋",
    category: "animation",
    promptTemplate:
      "Add polished hover states to all interactive elements. Buttons: subtle glow or scale(1.02). Cards: border highlight or slight elevation. Links: underline slide-in. All transitions: 150ms ease-out.",
  },
  // ── Structure ─────────────────────────────────────────
  {
    id: "qa-nav",
    label: "Add a navigation bar",
    icon: "📐",
    category: "structure",
    promptTemplate:
      "Add a clean navigation bar at the top of the page. Logo left, links center or right, optional CTA button. Styled to the project design system. Make it sticky on scroll.",
  },
  {
    id: "qa-footer",
    label: "Add a footer",
    icon: "📄",
    category: "structure",
    promptTemplate:
      "Add a minimal footer at the bottom of the page. Include placeholder links, copyright line. Styled to the project design system.",
  },
  {
    id: "qa-sections",
    label: "Break into sections",
    icon: "🃏",
    category: "structure",
    promptTemplate:
      "Restructure the current UI into clearly defined page sections with proper visual separation. Each section should have a clear purpose and breathing room.",
  },
];
