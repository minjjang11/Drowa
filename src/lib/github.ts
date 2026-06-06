import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken } from "./crypto";
import { decodeBinaryContent, encodeBinaryContent, isBinaryFilePath } from "./fileContent";

const API = "https://api.github.com";

export interface GitHubConnection {
  username: string;
  token: string;
}

/** Read + decrypt the current user's GitHub token (server-side only). */
export async function getConnection(
  supabase: SupabaseClient,
  userId: string,
): Promise<GitHubConnection | null> {
  const { data } = await supabase
    .from("github_connections")
    .select("github_username, access_token_encrypted")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    username: data.github_username as string,
    token: decryptToken(data.access_token_encrypted as string),
  };
}

async function gh(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

export interface RepoSummary {
  full_name: string;
  private: boolean;
  updated_at: string;
  default_branch: string;
}

export async function listRepos(token: string): Promise<RepoSummary[]> {
  const data = (await gh(token, "/user/repos?per_page=100&sort=updated")) as RepoSummary[];
  return data.map((r) => ({
    full_name: r.full_name,
    private: r.private,
    updated_at: r.updated_at,
    default_branch: r.default_branch,
  }));
}

export async function listBranches(token: string, repo: string): Promise<string[]> {
  const data = (await gh(token, `/repos/${repo}/branches?per_page=100`)) as { name: string }[];
  return data.map((b) => b.name);
}

export interface TreeEntry {
  path: string;
  type: string;
  sha: string;
}

/** Recursive file tree for a branch. */
export async function getTree(token: string, repo: string, branch: string): Promise<TreeEntry[]> {
  const ref = (await gh(token, `/repos/${repo}/git/ref/heads/${branch}`)) as {
    object: { sha: string };
  };
  const tree = (await gh(
    token,
    `/repos/${repo}/git/trees/${ref.object.sha}?recursive=1`,
  )) as { tree: TreeEntry[] };
  return tree.tree.filter((e) => e.type === "blob");
}

const ALLOWED = /\.(tsx?|jsx?|css|json|md|woff2?|ttf|otf|eot|png|jpe?g|gif|webp|ico)$/i;
const SKIP = /(^|\/)(node_modules|\.git|dist|\.next|build|out)\//;
const PRIORITY_IMPORTS = [
  /^package\.json$/i,
  /^next\.config\.[cm]?[jt]s$/i,
  /^vite\.config\.[cm]?[jt]s$/i,
  /^tsconfig\.json$/i,
  /^tailwind\.config\.[cm]?[jt]s$/i,
  /^postcss\.config\.[cm]?[jt]s$/i,
  /^src\/app\/layout\.[jt]sx?$/i,
  /^app\/layout\.[jt]sx?$/i,
  /^src\/app\/fonts\//i,
  /^app\/fonts\//i,
  /^src\/fonts\//i,
  /^fonts\//i,
  /^src\/app\/page\.[jt]sx?$/i,
  /^app\/page\.[jt]sx?$/i,
  /^pages\/index\.[jt]sx?$/i,
  /^src\/app\/globals\.css$/i,
  /^app\/globals\.css$/i,
  /^src\/App\.[jt]sx?$/i,
  /^src\/main\.[jt]sx?$/i,
  /^src\/index\.[jt]sx?$/i,
  /^App\.[jt]sx?$/i,
  /^index\.[jt]sx?$/i,
  /^src\/components\//i,
  /^components\//i,
  /^src\/lib\//i,
  /^lib\//i,
];

export function shouldImport(path: string): boolean {
  return ALLOWED.test(path) && !SKIP.test(path);
}

function importPriority(path: string): number {
  const index = PRIORITY_IMPORTS.findIndex((re) => re.test(path));
  return index === -1 ? PRIORITY_IMPORTS.length : index;
}

export function selectImportEntries(entries: TreeEntry[], maxFiles: number): TreeEntry[] {
  return entries
    .filter((entry) => shouldImport(entry.path))
    .sort((a, b) => importPriority(a.path) - importPriority(b.path) || a.path.localeCompare(b.path))
    .slice(0, maxFiles);
}

/** Fetch a file's content + blob SHA. Binary assets are stored as base64 markers. */
export async function getFileContent(
  token: string,
  repo: string,
  path: string,
  ref: string,
): Promise<{ content: string; sha: string }> {
  const data = (await gh(
    token,
    `/repos/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${ref}`,
  )) as { content: string; encoding: string; sha: string };
  const raw = data.content.replace(/\s/g, "");
  const content =
    data.encoding === "base64"
      ? isBinaryFilePath(path)
        ? encodeBinaryContent(path, raw)
        : Buffer.from(raw, "base64").toString("utf8")
      : data.content;
  return { content, sha: data.sha };
}

/** Create or update a file on the branch. Returns the new blob SHA. */
export async function putFile(
  token: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string,
  sha?: string,
): Promise<string> {
  const binary = decodeBinaryContent(content);
  const body: Record<string, unknown> = {
    message,
    content: binary ? binary.base64 : Buffer.from(content, "utf8").toString("base64"),
    branch,
  };
  if (sha) body.sha = sha;
  const data = (await gh(token, `/repos/${repo}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify(body),
  })) as { content: { sha: string } };
  return data.content.sha;
}

/** Latest remote blob SHA for a path, or null if it doesn't exist. */
export async function getFileSha(
  token: string,
  repo: string,
  path: string,
  ref: string,
): Promise<string | null> {
  try {
    const { sha } = await getFileContent(token, repo, path, ref);
    return sha;
  } catch {
    return null;
  }
}
