export type PatternType =
  | "bento_grid"
  | "glassmorphism"
  | "layered_cards"
  | "editorial"
  | "gradient"
  | "minimal"
  | "bold_type";

export interface Inspiration {
  id: string;
  title: string;
  patternType: PatternType;
  tags: string[];
  /** Short description of the look — folded into the Apply Style prompt. */
  description: string;
  /** data row only: user-uploaded reference image (data URL). */
  imageUrl?: string;
  isCurated?: boolean;
}

export const PATTERN_LABEL: Record<PatternType, string> = {
  bento_grid: "Bento Grid",
  glassmorphism: "Glassmorphism",
  layered_cards: "Layered Cards",
  editorial: "Editorial",
  gradient: "Gradient",
  minimal: "Minimal",
  bold_type: "Bold Typography",
};

/** Tailwind classes used to render a CSS preview tile per pattern (no screenshots needed). */
export const PATTERN_PREVIEW: Record<PatternType, string> = {
  bento_grid:
    "grid grid-cols-3 grid-rows-2 gap-1 p-2 [&>div]:rounded-[3px] [&>div]:bg-[#2a2a2a]",
  glassmorphism:
    "bg-gradient-to-br from-[#ec4899]/40 via-[#8b5cf6]/30 to-[#f59e0b]/30",
  layered_cards: "relative bg-[#0d0d0d]",
  editorial: "bg-[#0d0d0d] flex items-center justify-center",
  gradient: "bg-[radial-gradient(circle_at_30%_20%,#ec4899,transparent_40%),radial-gradient(circle_at_70%_70%,#8b5cf6,transparent_45%),radial-gradient(circle_at_50%_50%,#f59e0b,transparent_50%)]",
  minimal: "bg-[#0d0d0d] flex items-center justify-center",
  bold_type: "bg-[#0d0d0d] flex items-center justify-center",
};

export const CURATED: Inspiration[] = [
  {
    id: "bento-1",
    title: "Asymmetric feature grid",
    patternType: "bento_grid",
    tags: ["bento", "dark", "modular"],
    description:
      "Asymmetric grid of cards in varied sizes; one large feature tile anchoring smaller supporting tiles, tight gaps.",
  },
  {
    id: "bento-2",
    title: "Stats + visual bento",
    patternType: "bento_grid",
    tags: ["bento", "dashboard", "data"],
    description:
      "Mixed bento of metric cards and one visual/illustration tile; rounded corners, subtle borders.",
  },
  {
    id: "glass-1",
    title: "Frosted glass cards",
    patternType: "glassmorphism",
    tags: ["glassmorphism", "blur", "gradient"],
    description:
      "Frosted translucent cards (backdrop-blur, semi-transparent surface, thin light border) floating over a colorful gradient background.",
  },
  {
    id: "glass-2",
    title: "Layered blur panels",
    patternType: "glassmorphism",
    tags: ["glassmorphism", "depth", "layered"],
    description:
      "Stacked translucent blur panels at different depths; soft inner glow, frosted edges.",
  },
  {
    id: "layered-1",
    title: "Offset shadow stack",
    patternType: "layered_cards",
    tags: ["layered", "shadow", "tactile"],
    description:
      "Cards with an offset solid-color shadow behind them for a stacked, tactile, printed-poster feel.",
  },
  {
    id: "layered-2",
    title: "Overlapping image + text",
    patternType: "layered_cards",
    tags: ["layered", "overlap", "editorial"],
    description:
      "Image and text blocks that overlap and break the grid; intentional layering and negative space.",
  },
  {
    id: "editorial-1",
    title: "Serif headline, minimal body",
    patternType: "editorial",
    tags: ["editorial", "serif", "magazine"],
    description:
      "Large italic serif headline, generous line-height, sparse sans body — a magazine/editorial layout.",
  },
  {
    id: "editorial-2",
    title: "Full-bleed image with overlay",
    patternType: "editorial",
    tags: ["editorial", "full-bleed", "overlay"],
    description:
      "Full-bleed hero image with a serif text overlay and a thin rule; cinematic, editorial.",
  },
  {
    id: "gradient-1",
    title: "Mesh gradient hero",
    patternType: "gradient",
    tags: ["gradient", "mesh", "vibrant"],
    description:
      "A vibrant multi-stop mesh gradient backdrop with high-contrast white/serif text over it.",
  },
  {
    id: "gradient-2",
    title: "Aurora background",
    patternType: "gradient",
    tags: ["gradient", "aurora", "glow"],
    description:
      "Soft aurora-like blurred gradient blobs in motion behind content; deep dark base.",
  },
  {
    id: "minimal-1",
    title: "Whitespace-heavy layout",
    patternType: "minimal",
    tags: ["minimal", "whitespace", "calm"],
    description:
      "Ultra-clean, whitespace-heavy composition; few elements, strong alignment, restrained type.",
  },
  {
    id: "minimal-2",
    title: "Monochrome, single accent",
    patternType: "minimal",
    tags: ["minimal", "monochrome", "accent"],
    description:
      "Monochrome palette with exactly one accent color used sparingly for emphasis.",
  },
  {
    id: "bold-1",
    title: "Oversized display hero",
    patternType: "bold_type",
    tags: ["bold", "display", "type"],
    description:
      "Oversized display headline that dominates the viewport; type is the hero, minimal supporting UI.",
  },
  {
    id: "bold-2",
    title: "Mixed serif + mono headline",
    patternType: "bold_type",
    tags: ["bold", "serif", "mono"],
    description:
      "Headline mixing large italic serif with monospace accents; high typographic contrast.",
  },
];

/** Build the Apply Style prompt that gets pre-filled into the chat input. */
export function buildApplyPrompt(insp: Inspiration): string {
  return `Redesign the current UI using a ${PATTERN_LABEL[insp.patternType]} aesthetic.
Key characteristics: ${insp.description} Tags: ${insp.tags.join(", ")}.
Keep the existing content and structure, only change the visual style.
Follow the project design system tokens.`;
}

/** Prompt sent alongside an uploaded image for "Match this style". */
export const MATCH_STYLE_PROMPT = `Analyze this image and identify:
1. Color palette (extract main colors)
2. Typography style (serif/sans/mono, weight, size hierarchy)
3. Layout pattern (grid type, spacing density)
4. Design mood (minimal/bold/warm/dark/editorial etc)
Then redesign the current UI to match this aesthetic, using the project's existing design system as a base. Keep existing content and structure.`;
