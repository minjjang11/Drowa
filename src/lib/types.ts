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
