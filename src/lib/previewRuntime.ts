export type PreviewRuntimeMode = "iframe" | "esbuild" | "webcontainer";

export interface ProjectFile {
  path: string;
  content: string;
}

export interface PreviewRuntimeDecision {
  mode: PreviewRuntimeMode;
  reason: string;
  entry: string;
}

const SIMPLE_ENTRY_CANDIDATES = [
  "App.tsx",
  "App.jsx",
  "src/app/page.tsx",
  "src/app/page.jsx",
  "app/page.tsx",
  "app/page.jsx",
  "pages/index.tsx",
  "pages/index.jsx",
  "src/App.tsx",
  "src/App.jsx",
  "src/main.tsx",
  "src/main.jsx",
  "src/index.tsx",
  "src/index.jsx",
  "index.tsx",
  "index.jsx",
];

const SERVER_HINTS = [
  /(^|\/)next\.config\.[cm]?[jt]s$/,
  /(^|\/)app\/api\//,
  /(^|\/)pages\/api\//,
  /(^|\/)server\.[cm]?[jt]s$/,
  /(^|\/)src\/server\//,
  /(^|\/)api\//,
];

const UI_FILE_RE = /\.(tsx|jsx|ts|js|vue|svelte|html)$/;

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

export function pickRuntimeEntry(files: ProjectFile[]): string {
  const paths = new Set(files.map((f) => normalizePath(f.path)));
  for (const candidate of SIMPLE_ENTRY_CANDIDATES) {
    if (paths.has(candidate)) return candidate;
  }
  return (
    files.find((f) => UI_FILE_RE.test(f.path) && /export\s+default/.test(f.content))?.path ??
    files.find((f) => UI_FILE_RE.test(f.path))?.path ??
    "App.tsx"
  );
}

function packageJson(files: ProjectFile[]): Record<string, unknown> | null {
  const pkg = files.find((f) => normalizePath(f.path) === "package.json");
  if (!pkg) return null;
  try {
    return JSON.parse(pkg.content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function hasServerRuntime(files: ProjectFile[]): boolean {
  const paths = files.map((f) => normalizePath(f.path));
  if (paths.some((p) => SERVER_HINTS.some((re) => re.test(p)))) return true;

  const pkg = packageJson(files);
  const deps = {
    ...((pkg?.dependencies as Record<string, unknown> | undefined) ?? {}),
    ...((pkg?.devDependencies as Record<string, unknown> | undefined) ?? {}),
  };
  return Boolean(deps.next || deps["@remix-run/react"] || deps.express || deps.fastify);
}

function hasLocalImports(file: ProjectFile): boolean {
  return /from\s+["'](\.|@\/)|import\s+["']\./.test(file.content);
}

export function decidePreviewRuntime(files: ProjectFile[]): PreviewRuntimeDecision {
  const normalized = files
    .filter((f) => normalizePath(f.path) !== "overrides.json")
    .map((f) => ({ ...f, path: normalizePath(f.path) }));
  const entry = pickRuntimeEntry(normalized);
  const codeFiles = normalized.filter((f) => UI_FILE_RE.test(f.path));

  if (hasServerRuntime(normalized)) {
    return {
      mode: "webcontainer",
      entry,
      reason: "Full project runtime detected",
    };
  }

  if (codeFiles.length > 1 || codeFiles.some(hasLocalImports)) {
    return {
      mode: "esbuild",
      entry,
      reason: "Multi-file front-end bundle",
    };
  }

  return {
    mode: "iframe",
    entry,
    reason: "Fast single-file preview",
  };
}

export function runtimeLabel(mode: PreviewRuntimeMode): string {
  if (mode === "webcontainer") return "WebContainer";
  if (mode === "esbuild") return "esbuild";
  return "iframe";
}
