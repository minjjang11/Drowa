"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProjectFile } from "@/lib/previewRuntime";
import { decodeBinaryContent } from "@/lib/fileContent";
import { buildEnvFile, parsePreviewEnv } from "@/lib/previewEnv";

type WebContainerLike = {
  mount: (tree: Record<string, unknown>) => Promise<void>;
  spawn: (command: string, args?: string[]) => Promise<{
    output: ReadableStream<string>;
    exit: Promise<number>;
    kill?: () => void;
  }>;
  on: (event: "server-ready", cb: (port: number, url: string) => void) => void;
};

let bootPromise: Promise<WebContainerLike> | null = null;

interface WebContainerPreviewProps {
  files: ProjectFile[];
  editMode: boolean;
  /** Public-only env (NEXT_PUBLIC_ / VITE_ keys) injected as .env.local so the real backend works. */
  previewEnv?: string | null;
  onError?: (err: { message: string; stack?: string; line?: number }) => void;
  /** Explicit opt-in to the no-backend front-end (esbuild) preview after a boot failure. */
  onQuickPreview?: () => void;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function readPackage(files: ProjectFile[]): {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
} | null {
  const pkg = files.find((file) => normalizePath(file.path) === "package.json");
  if (!pkg) return null;
  try {
    return JSON.parse(pkg.content);
  } catch {
    return null;
  }
}

function fallbackPackageJson(): string {
  return JSON.stringify(
    {
      scripts: { dev: "vite --host 0.0.0.0" },
      dependencies: {
        "@vitejs/plugin-react": "latest",
        vite: "latest",
        typescript: "latest",
        react: "latest",
        "react-dom": "latest",
      },
      devDependencies: {},
    },
    null,
    2,
  );
}

/** Injects a public-only .env.local (and .env) so the real backend client connects. */
function envFiles(previewEnv: string | null | undefined): ProjectFile[] {
  const { safe } = parsePreviewEnv(previewEnv);
  if (Object.keys(safe).length === 0) return [];
  const body = buildEnvFile(safe);
  return [
    { path: ".env.local", content: body },
    { path: ".env", content: body },
  ];
}

function ensureRuntimeFiles(files: ProjectFile[], previewEnv: string | null | undefined): ProjectFile[] {
  const normalized = files.map((file) => ({ ...file, path: normalizePath(file.path) }));
  // User-provided env always wins over any committed .env in the repo.
  const env = envFiles(previewEnv);
  const envPaths = new Set(env.map((f) => f.path));
  const withoutEnv = normalized.filter((f) => !envPaths.has(f.path));
  const hasPackage = withoutEnv.some((file) => file.path === "package.json");
  if (hasPackage) return [...withoutEnv, ...env];

  const app = withoutEnv.find((file) => file.path === "App.tsx")?.content ?? "export default function App() { return null; }";
  return [
    { path: "package.json", content: fallbackPackageJson() },
    { path: "index.html", content: '<div id="root"></div><script type="module" src="/src/main.tsx"></script>' },
    {
      path: "src/main.tsx",
      content: `import React from "react";
import { createRoot } from "react-dom/client";
import App from "../App";

createRoot(document.getElementById("root")!).render(<App />);`,
    },
    ...withoutEnv.filter((file) => file.path !== "overrides.json"),
    { path: "App.tsx", content: app },
    ...env,
  ];
}

function toFileTree(files: ProjectFile[], previewEnv: string | null | undefined): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const file of ensureRuntimeFiles(files, previewEnv)) {
    if (file.path === "overrides.json") continue;
    const content = file.content;
    const parts = normalizePath(file.path).split("/");
    let cursor = root;
    for (const part of parts.slice(0, -1)) {
      const existing = cursor[part] as { directory?: Record<string, unknown> } | undefined;
      if (!existing?.directory) cursor[part] = { directory: {} };
      cursor = (cursor[part] as { directory: Record<string, unknown> }).directory;
    }
    const binary = decodeBinaryContent(content);
    cursor[parts[parts.length - 1]] = {
      file: { contents: binary ? base64ToBytes(binary.base64) : content },
    };
  }
  return root;
}

interface RunCmd {
  command: string;
  args: string[];
  label: string;
}

function isNextApp(files: ProjectFile[]): boolean {
  const pkg = readPackage(files);
  const dev = pkg?.scripts?.dev ?? "";
  const start = pkg?.scripts?.start ?? "";
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  return /\bnext\b/.test(dev) || /\bnext\b/.test(start) || Boolean(deps.next);
}

// Next apps run in PRODUCTION mode (build + start) so the preview matches the
// real deployed site and avoids `next dev`'s prerender-time request-scope errors
// (e.g. `cookies()` called outside a request scope). Other stacks use the dev server.
function runPlan(files: ProjectFile[]): { build?: RunCmd; run: RunCmd } {
  const pkg = readPackage(files);
  if (isNextApp(files)) {
    const build: RunCmd = pkg?.scripts?.build
      ? { command: "npm", args: ["run", "build"], label: "npm run build" }
      : { command: "npx", args: ["next", "build"], label: "next build" };
    const run: RunCmd = pkg?.scripts?.start
      ? { command: "npm", args: ["run", "start", "--", "-H", "0.0.0.0"], label: "npm run start" }
      : { command: "npx", args: ["next", "start", "-H", "0.0.0.0"], label: "next start" };
    return { build, run };
  }
  const run: RunCmd = { command: "npm", args: ["run", "dev", "--", "--host", "0.0.0.0"], label: "npm run dev" };
  return { run };
}

async function bootWebContainer(): Promise<WebContainerLike> {
  if (!bootPromise) {
    bootPromise = import("@webcontainer/api").then(({ WebContainer }) => WebContainer.boot() as Promise<WebContainerLike>);
  }
  return bootPromise;
}

export function WebContainerPreview({ files, editMode, previewEnv, onError, onQuickPreview }: WebContainerPreviewProps) {
  const [status, setStatus] = useState("Booting environment...");
  const [url, setUrl] = useState<string | null>(null);
  const [log, setLog] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const processRef = useRef<{ kill?: () => void } | null>(null);
  const signature = useMemo(
    () => JSON.stringify([previewEnv ?? "", files.map((file) => [file.path, file.content])]),
    [files, previewEnv],
  );
  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setError(null);
    setLog("");

    async function start() {
      try {
        setStatus("Starting Node runtime...");
        const webcontainer = await bootWebContainer();
        if (cancelled) return;

        processRef.current?.kill?.();
        setStatus("Mounting project files...");
        await webcontainer.mount(toFileTree(files, previewEnv));
        if (cancelled) return;

        // Prefer the deterministic `npm ci` when a lockfile is present.
        const hasLock = files.some((f) => normalizePath(f.path) === "package-lock.json");
        setStatus(hasLock ? "Installing dependencies (npm ci)..." : "Installing dependencies...");
        let installLog = "";
        const installArgs = hasLock
          ? ["ci", "--no-audit", "--no-fund", "--ignore-scripts"]
          : ["install", "--legacy-peer-deps", "--no-audit", "--no-fund", "--ignore-scripts"];
        const install = await webcontainer.spawn("npm", installArgs);
        install.output.pipeTo(
          new WritableStream({
            write(data) {
              installLog = `${installLog}${data}`.slice(-2400);
              setLog((prev) => `${prev}${data}`.slice(-2400));
            },
          }),
        );
        const installExit = await install.exit;
        if (installExit !== 0) {
          throw new Error(`npm install failed inside WebContainer\n${installLog.trim()}`);
        }
        if (cancelled) return;

        const plan = runPlan(files);

        // Production build step (Next apps) — faithful to the deployed site.
        if (plan.build) {
          setStatus("Building for production...");
          let buildLog = "";
          const build = await webcontainer.spawn(plan.build.command, plan.build.args);
          build.output.pipeTo(
            new WritableStream({
              write(data) {
                buildLog = `${buildLog}${data}`.slice(-2400);
                setLog((prev) => `${prev}${data}`.slice(-2400));
              },
            }),
          );
          const buildExit = await build.exit;
          if (buildExit !== 0) {
            throw new Error(`${plan.build.label} failed inside WebContainer\n${buildLog.trim()}`);
          }
          if (cancelled) return;
        }

        const run = plan.run;
        setStatus(`${run.label}...`);
        webcontainer.on("server-ready", (_port, readyUrl) => {
          if (!cancelled) {
            setUrl(readyUrl);
            setStatus("Runtime ready");
          }
        });
        const proc = await webcontainer.spawn(run.command, run.args);
        processRef.current = proc;
        proc.output.pipeTo(
          new WritableStream({
            write(data) {
              setLog((prev) => `${prev}${data}`.slice(-2400));
            },
          }),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "WebContainer failed";
        if (!cancelled) {
          setError(message);
          setStatus("Runtime failed");
          onError?.({ message });
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      processRef.current?.kill?.();
      processRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, reloadKey, onError]);

  if (url) {
    return (
      <div className="relative h-full w-full bg-white">
        <iframe title="webcontainer preview" src={url} className="h-full w-full border-0 bg-white" />
        {editMode && (
          <div className="liquid-glass absolute left-3 top-3 rounded-[6px] px-3 py-1.5 font-mono text-[10px] text-muted">
            Visual editing is paused in WebContainer mode.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-background p-6">
      <div className="liquid-glass w-full max-w-lg rounded-[8px] p-4">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${error ? "bg-error" : "amber-pulse bg-accent"}`} />
          <p className="serif text-lg italic text-foreground">{status}</p>
        </div>
        <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted">
          Full-stack previews run in a browser Node environment. External services like Supabase still need real env keys.
        </p>
        {log && (
          <pre className="mt-3 max-h-40 overflow-auto rounded-[4px] bg-[#0f0f0f] p-3 font-mono text-[10px] leading-relaxed text-[#f8f7f4]">
            {log}
          </pre>
        )}
        {error && <p className="mt-3 font-mono text-[11px] text-error">{error}</p>}
        {error && (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={retry}
              className="btn-primary rounded-[6px] px-3 py-1.5 text-[12px] text-white"
            >
              Retry
            </button>
            {onQuickPreview && (
              <button
                type="button"
                onClick={onQuickPreview}
                className="btn-ghost rounded-[6px] px-3 py-1.5 text-[12px]"
              >
                Quick preview (no backend)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
