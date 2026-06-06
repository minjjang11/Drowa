"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ProjectFile } from "@/lib/previewRuntime";

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
  onError?: (err: { message: string; stack?: string; line?: number }) => void;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
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

function ensureRuntimeFiles(files: ProjectFile[]): ProjectFile[] {
  const normalized = files.map((file) => ({ ...file, path: normalizePath(file.path) }));
  const hasPackage = normalized.some((file) => file.path === "package.json");
  if (hasPackage) return normalized;

  const app = normalized.find((file) => file.path === "App.tsx")?.content ?? "export default function App() { return null; }";
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
    ...normalized.filter((file) => file.path !== "overrides.json"),
    { path: "App.tsx", content: app },
  ];
}

function toFileTree(files: ProjectFile[]): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const file of ensureRuntimeFiles(files)) {
    if (file.path === "overrides.json") continue;
    const parts = normalizePath(file.path).split("/");
    let cursor = root;
    for (const part of parts.slice(0, -1)) {
      const existing = cursor[part] as { directory?: Record<string, unknown> } | undefined;
      if (!existing?.directory) cursor[part] = { directory: {} };
      cursor = (cursor[part] as { directory: Record<string, unknown> }).directory;
    }
    cursor[parts[parts.length - 1]] = { file: { contents: file.content } };
  }
  return root;
}

function devCommand(files: ProjectFile[]): { command: string; args: string[]; label: string } {
  const pkg = readPackage(files);
  const dev = pkg?.scripts?.dev;
  if (!dev) return { command: "npm", args: ["run", "dev", "--", "--host", "0.0.0.0"], label: "npm run dev" };
  if (/\bnext\s+dev\b/.test(dev)) {
    return { command: "npm", args: ["run", "dev", "--", "--hostname", "0.0.0.0"], label: "npm run dev" };
  }
  return { command: "npm", args: ["run", "dev", "--", "--host", "0.0.0.0"], label: "npm run dev" };
}

async function bootWebContainer(): Promise<WebContainerLike> {
  if (!bootPromise) {
    bootPromise = import("@webcontainer/api").then(({ WebContainer }) => WebContainer.boot() as Promise<WebContainerLike>);
  }
  return bootPromise;
}

export function WebContainerPreview({ files, editMode, onError }: WebContainerPreviewProps) {
  const [status, setStatus] = useState("Booting environment...");
  const [url, setUrl] = useState<string | null>(null);
  const [log, setLog] = useState("");
  const [error, setError] = useState<string | null>(null);
  const processRef = useRef<{ kill?: () => void } | null>(null);
  const signature = useMemo(() => JSON.stringify(files.map((file) => [file.path, file.content])), [files]);

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
        await webcontainer.mount(toFileTree(files));
        if (cancelled) return;

        setStatus("Installing dependencies...");
        let installLog = "";
        const install = await webcontainer.spawn("npm", [
          "install",
          "--legacy-peer-deps",
          "--no-audit",
          "--no-fund",
          "--ignore-scripts",
        ]);
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

        const run = devCommand(files);
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
  }, [signature, files, onError]);

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
      </div>
    </div>
  );
}
