export type MemberRole = "developer" | "designer";
export type AiRole = "dev_ai" | "design_ai";

export interface Project {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  project_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
}

export interface FileRow {
  id: string;
  project_id: string;
  path: string;
  content: string;
  updated_at: string;
}

export interface ContextMd {
  project_id: string;
  content: string;
  updated_at: string;
}

export interface Message {
  id: string;
  project_id: string;
  user_id: string | null;
  role: AiRole;
  content: string;
  created_at: string;
}

/** Maps a chat role to which kind of member talks to it. */
export const AI_LABEL: Record<AiRole, string> = {
  dev_ai: "Developer AI",
  design_ai: "Designer AI",
};

// ─── Visual editor ───────────────────────────────────────────────
/** A partial set of inline CSS props (camelCase keys) applied to one element. */
export type StyleMap = Record<string, string>;

/** Per-project overrides: drowa element id → style props. Stored as overrides.json. */
export type Overrides = Record<string, StyleMap>;

/** Payload the iframe sends when an element is clicked. */
export interface Selection {
  id: string;
  tag: string;
  styles: StyleMap;
}

// ─── Design system (Phase 3-1) ───────────────────────────────────
export interface DesignTokens {
  colors: {
    background: string;
    surface: string;
    surfaceElevated: string;
    border: string;
    accentPrimary: string;
    accentSecondary: string;
    textPrimary: string;
    textSecondary: string;
    error: string;
    success: string;
  };
  typography: {
    fontDisplay: string;
    fontUI: string;
    fontMono: string;
    scaleBase: string;
    scaleRatio: string;
  };
  spacing: {
    unit: string;
    scale: number[];
  };
  radius: {
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
}

export const DEFAULT_TOKENS: DesignTokens = {
  colors: {
    background: "#0d0d0d",
    surface: "#141414",
    surfaceElevated: "#1a1a1a",
    border: "#2a2a2a",
    accentPrimary: "#f59e0b",
    accentSecondary: "#ec4899",
    textPrimary: "#f5f5f0",
    textSecondary: "#888880",
    error: "#ef4444",
    success: "#22c55e",
  },
  typography: {
    fontDisplay: "Playfair Display",
    fontUI: "Geist Sans",
    fontMono: "Geist Mono",
    scaleBase: "16px",
    scaleRatio: "1.25",
  },
  spacing: {
    unit: "4px",
    scale: [4, 8, 12, 16, 24, 32, 48, 64],
  },
  radius: {
    sm: "4px",
    md: "8px",
    lg: "12px",
    full: "9999px",
  },
};

/** Preview device frame. */
export type DeviceMode = "desktop" | "tablet" | "mobile";

/** Workspace save/generation status, drives the toolbar status pill. */
export type Status = "ready" | "generating" | "saved" | "error";
