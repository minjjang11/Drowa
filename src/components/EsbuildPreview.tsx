"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { EDITOR_SCRIPT, type PreviewHandle } from "./Preview";
import type { Overrides, Selection, StyleMap } from "@/lib/types";
import type { ProjectFile } from "@/lib/previewRuntime";

type Esbuild = typeof import("esbuild-wasm");

let esbuildModule: Promise<Esbuild> | null = null;
let esbuildReady: Promise<void> | null = null;

interface EsbuildPreviewProps {
  files: ProjectFile[];
  entry: string;
  overrides: Overrides;
  editMode: boolean;
  onSelect: (sel: Selection | null) => void;
  onMove: (id: string, transform: string) => void;
  onError?: (err: { message: string; stack?: string; line?: number }) => void;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function dirname(path: string): string {
  const p = normalizePath(path);
  return p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
}

function resolveLocalImport(spec: string, fromDir: string, files: Map<string, string>): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = `src/${spec.slice(2)}`;
  else if (spec.startsWith(".")) base = normalizePath(`${fromDir ? `${fromDir}/` : ""}${spec}`);
  else return null;

  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    `${base}.vue`,
    `${base}.svelte`,
    `${base}/index.tsx`,
    `${base}/index.ts`,
    `${base}/index.jsx`,
    `${base}/index.js`,
  ];
  return candidates.find((candidate) => files.has(candidate)) ?? null;
}

function createFileMap(files: ProjectFile[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const file of files) {
    const path = normalizePath(file.path);
    if (path === "overrides.json") continue;
    map.set(path, file.content);
  }
  return map;
}

function createEntrySource(entry: string, files: Map<string, string>): string {
  const source = files.get(entry) ?? "";
  const isMainEntry = /(^|\/)(main|index)\.[jt]sx?$/.test(entry) && /createRoot|render\(/.test(source);
  if (isMainEntry) return `import "./${entry}";`;
  const isServerEntry =
    /export\s+default\s+async\s+function/.test(source) ||
    /from\s+["']next\/(headers|cookies|server)["']/.test(source) ||
    /import\s+\{[^}]*\b(redirect|notFound)\b[^}]*\}\s+from\s+["']next\/navigation["']/.test(source) ||
    /from\s+["']@\/lib\/supabase\/server["']/.test(source);
  if (isServerEntry) {
    return `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./${entry}";

async function renderServerEntry() {
  const root = createRoot(document.getElementById("root"));
  const result = App();
  const element = result && typeof result.then === "function" ? await result : result;
  root.render(element || React.createElement(React.Fragment));
}

renderServerEntry().catch((err) => {
  setTimeout(() => {
    throw err;
  }, 0);
});`;
  }
  return `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./${entry}";

createRoot(document.getElementById("root")!).render(React.createElement(App));`;
}

function createReactShim(): string {
  return `const React = window.React;
export default React;
export const Fragment = React.Fragment;
export const useState = React.useState;
export const useEffect = React.useEffect;
export const useRef = React.useRef;
export const useMemo = React.useMemo;
export const useCallback = React.useCallback;
export const useReducer = React.useReducer;
export const useContext = React.useContext;
export const createElement = React.createElement;`;
}

function createReactDomShim(): string {
  return `const ReactDOM = window.ReactDOM;
export const createRoot = ReactDOM.createRoot.bind(ReactDOM);
export default { createRoot };`;
}

function isServerOnlyModule(path: string, contents: string): boolean {
  return (
    /^\s*["']use server["'];?/m.test(contents) ||
    /server-only/.test(contents) ||
    /(^|\/)lib\/supabase\/server\.[jt]s$/.test(path) ||
    /(^|\/)actions\.[jt]s$/.test(path) ||
    /from\s+["']next\/(headers|cookies)["']/.test(contents)
  );
}

function exportedNames(contents: string): Set<string> {
  const names = new Set<string>();
  const re = /export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(contents))) names.add(match[1]);

  const listRe = /export\s*\{([^}]*)\}/g;
  while ((match = listRe.exec(contents))) {
    for (const part of match[1].split(",")) {
      const exported = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (exported && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(exported)) names.add(exported);
    }
  }
  return names;
}

function createServerModuleShim(contents: string): string {
  const names = new Set(["createClient", "signOut", ...exportedNames(contents)]);
  return `function makeQuery(data) {
  const result = { data, error: null };
  const query = {
    select() { return query; },
    eq() { return query; },
    neq() { return query; },
    in() { return query; },
    order() { return query; },
    limit() { return query; },
    insert() { return query; },
    update() { return query; },
    upsert() { return query; },
    delete() { return query; },
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: null, error: null }),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
}
const previewUser = { id: "preview-user", email: "preview@example.com" };
const previewSupabase = {
  auth: { getUser: async () => ({ data: { user: previewUser }, error: null }) },
  from: () => makeQuery([]),
};
export async function createClient() { return previewSupabase; }
export async function signOut() {}
${Array.from(names)
  .filter((name) => name !== "createClient" && name !== "signOut")
  .map((name) => `export async function ${name}() { return null; }`)
  .join("\n")}
export default async function serverStub() { return null; }`;
}

function collectExternalNamedImports(files: Map<string, string>): Map<string, Set<string>> {
  const imports = new Map<string, Set<string>>();
  for (const source of files.values()) {
    const re = /import\s+(?:type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(source))) {
      const clause = match[1];
      const spec = match[2];
      if (spec === "react" || spec === "react-dom/client" || spec.startsWith(".") || spec.startsWith("@/")) continue;
      const named = /\{([^}]*)\}/.exec(clause);
      if (!named) continue;
      const set = imports.get(spec) ?? new Set<string>();
      for (const part of named[1].split(",")) {
        const name = part.trim().split(/\s+as\s+/)[0]?.trim();
        if (name && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) set.add(name);
      }
      imports.set(spec, set);
    }
  }
  return imports;
}

function createExternalShim(spec: string, requestedNames: Set<string> = new Set()): string {
  if (spec === "next/link") {
    return `const React = window.React;
export default function Link(props) {
  const safe = Object.assign({}, props, { href: String((props && props.href) || "#") });
  return React.createElement("a", safe, props && props.children);
}`;
  }

  if (spec === "next/image") {
    return `const React = window.React;
export default function Image(props) {
  const safe = Object.assign({}, props, { alt: (props && props.alt) || "" });
  delete safe.fill;
  delete safe.priority;
  return React.createElement("img", safe);
}`;
  }

  if (spec === "next/navigation") {
    return `const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
export function useRouter() { return router; }
export function usePathname() { return "/"; }
export function useSearchParams() { return new URLSearchParams(); }
export function redirect() {}
export function notFound() {}
export default router;`;
  }

  if (spec === "next/font/google" || spec === "next/font/local") {
    const fontNames = ["Geist", "Geist_Mono", "Inter", "Instrument_Serif", "Roboto", "Poppins", "Lora"];
    return `function font() { return { className: "", variable: "", style: {} }; }
${fontNames.map((name) => `export const ${name} = font;`).join("\n")}
export default font;`;
  }

  const exportNames = new Set([
    "clsx",
    "cn",
    "twMerge",
    "motion",
    "AnimatePresence",
    "Button",
    "Card",
    "Input",
    ...requestedNames,
  ]);
  return `const stub = new Proxy(function ${spec.replace(/[^A-Za-z0-9_$]/g, "_")}() { return null; }, {
  get: function () { return stub; },
  apply: function () { return null; }
});
export default stub;
${Array.from(exportNames).map((name) => `export const ${name} = stub;`).join("\n")}`;
}

async function loadEsbuild(): Promise<Esbuild> {
  if (!esbuildModule) esbuildModule = import("esbuild-wasm");
  const esbuild = await esbuildModule;
  if (!esbuildReady) {
    esbuildReady = esbuild.initialize({
      wasmURL: "https://unpkg.com/esbuild-wasm@0.28.0/esbuild.wasm",
      worker: true,
    });
  }
  await esbuildReady;
  return esbuild;
}

async function bundleWithEsbuild(files: ProjectFile[], entry: string): Promise<string> {
  const esbuild = await loadEsbuild();
  const fileMap = createFileMap(files);
  const externalNamedImports = collectExternalNamedImports(fileMap);
  const normalizedEntry = normalizePath(entry);
  const virtualEntry = "__drowa_entry.tsx";

  const result = await esbuild.build({
    entryPoints: [virtualEntry],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: ["es2018"],
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    loader: {
      ".js": "jsx",
      ".jsx": "jsx",
      ".ts": "tsx",
      ".tsx": "tsx",
      ".css": "text",
      ".svg": "dataurl",
      ".png": "dataurl",
      ".jpg": "dataurl",
      ".jpeg": "dataurl",
      ".webp": "dataurl",
    },
    plugins: [
      {
        name: "drowa-project-files",
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) => {
            if (args.path === virtualEntry) return { path: virtualEntry, namespace: "drowa" };
            if (args.path === "react") return { path: "react", namespace: "drowa-shim" };
            if (args.path === "react-dom/client") return { path: "react-dom/client", namespace: "drowa-shim" };
            if (args.path.endsWith(".css")) return { path: args.path, namespace: "drowa-empty" };
            if (/^(https?:)?\/\//.test(args.path)) return { path: args.path, external: true };

            const fromDir = args.resolveDir.replace(/^\/+/, "");
            const resolved = resolveLocalImport(args.path, fromDir, fileMap);
            if (resolved) {
              const contents = fileMap.get(resolved) ?? "";
              if (isServerOnlyModule(resolved, contents)) {
                return { path: `/${resolved}`, namespace: "drowa-server-stub", resolveDir: `/${dirname(resolved)}` };
              }
              return { path: `/${resolved}`, namespace: "drowa-project", resolveDir: `/${dirname(resolved)}` };
            }
            return { path: args.path, namespace: "drowa-external" };
          });

          build.onLoad({ filter: /.*/, namespace: "drowa" }, () => ({
            loader: "tsx",
            resolveDir: "/",
            contents: createEntrySource(normalizedEntry, fileMap),
          }));

          build.onLoad({ filter: /.*/, namespace: "drowa-project" }, (args) => {
            const path = normalizePath(args.path);
            const contents = fileMap.get(path);
            if (contents == null) return null;
            const withDefault =
              path === normalizedEntry &&
              !/export\s+default/.test(contents) &&
              /\bfunction\s+App\b|\bconst\s+App\b/.test(contents)
                ? `${contents}\nexport default App;`
                : contents;
            return {
              loader: path.endsWith(".ts") ? "tsx" : path.endsWith(".js") ? "jsx" : "tsx",
              resolveDir: `/${dirname(path)}`,
              contents: withDefault,
            };
          });

          build.onLoad({ filter: /.*/, namespace: "drowa-server-stub" }, (args) => {
            const path = normalizePath(args.path);
            return {
              loader: "js",
              contents: createServerModuleShim(fileMap.get(path) ?? ""),
            };
          });

          build.onLoad({ filter: /^react$/, namespace: "drowa-shim" }, () => ({
            loader: "js",
            contents: createReactShim(),
          }));

          build.onLoad({ filter: /^react-dom\/client$/, namespace: "drowa-shim" }, () => ({
            loader: "js",
            contents: createReactDomShim(),
          }));

          build.onLoad({ filter: /.*/, namespace: "drowa-empty" }, () => ({ loader: "js", contents: "" }));
          build.onLoad({ filter: /.*/, namespace: "drowa-external" }, (args) => ({
            loader: "js",
            contents: createExternalShim(args.path, externalNamedImports.get(args.path)),
          }));
        },
      },
    ],
  });

  return result.outputFiles[0]?.text ?? "";
}

function buildSrcDoc(bundle: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link crossorigin href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
    <script crossorigin src="https://cdn.tailwindcss.com"></script>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <style>
      html,body,#root{height:100%;margin:0;}
      body{background:#f8f7f4;color:#0f0f0f;font-family:"Geist",ui-sans-serif,system-ui;}
      [data-drowa-selected]{outline:2px solid #0f0f0f !important;outline-offset:1px;}
      .drowa-edit [data-drowa-id]{cursor:pointer;}
      .drowa-dragging{opacity:.5 !important;}
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script>
      window.addEventListener("error", function (e) {
        parent.postMessage({ type: "drowa:error", message: e.message, stack: (e.error && e.error.stack) || "", line: e.lineno }, "*");
      });
      window.addEventListener("unhandledrejection", function (e) {
        var r = e.reason || {};
        parent.postMessage({ type: "drowa:error", message: String(r.message || r), stack: String(r.stack || "") }, "*");
      });
      try {
        ${bundle}
      } catch (err) {
        parent.postMessage({ type: "drowa:error", message: String(err && err.message ? err.message : err), stack: String(err && err.stack ? err.stack : "") }, "*");
      }
      setTimeout(function () {
        var root = document.getElementById("root");
        if (!root) return;
        var hasContent = root.textContent.trim().length > 0 || root.querySelector("img,svg,canvas,video,input,button,a");
        if (!hasContent) {
          var message = "Preview rendered an empty page. This project may need the full Next.js runtime or a different entry file.";
          parent.postMessage({ type: "drowa:error", message: message, stack: "" }, "*");
          root.innerHTML =
            '<div style="height:100%;display:flex;align-items:center;justify-content:center;padding:24px;font:13px ui-monospace,SFMono-Regular,Menlo,monospace;color:#888880;text-align:center">' +
            '<div><p style="margin:0 0 6px;color:#0f0f0f;font:italic 22px Georgia,serif">Preview could not render this entry</p>' +
            '<p style="margin:0">Open Files or pull from GitHub to load the full project entry.</p></div></div>';
        }
      }, 1600);
    </script>
    ${EDITOR_SCRIPT}
  </body>
</html>`;
}

export const EsbuildPreview = forwardRef<PreviewHandle, EsbuildPreviewProps>(function EsbuildPreview(
  { files, entry, overrides, editMode, onSelect, onMove, onError },
  ref,
) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const overridesRef = useRef(overrides);
  const editModeRef = useRef(editMode);
  const [srcDoc, setSrcDoc] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  overridesRef.current = overrides;
  editModeRef.current = editMode;

  const signature = useMemo(
    () => JSON.stringify({ entry, files: files.map((file) => [file.path, file.content]) }),
    [entry, files],
  );

  function post(msg: Record<string, unknown>) {
    iframeRef.current?.contentWindow?.postMessage(msg, "*");
  }

  useImperativeHandle(ref, () => ({
    applyStyle(id: string, style: StyleMap) {
      post({ type: "drowa:updateStyle", id, style });
    },
    clearSelection() {
      post({ type: "drowa:clearSelection" });
    },
    selectById(id: string) {
      post({ type: "drowa:selectId", id });
    },
  }));

  useEffect(() => {
    let cancelled = false;
    setError(null);
    bundleWithEsbuild(files, entry)
      .then((bundle) => {
        if (!cancelled) setSrcDoc(buildSrcDoc(bundle));
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "esbuild failed";
        if (!cancelled) {
          setError(message);
          onError?.({ message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [signature, files, entry, onError]);

  useEffect(() => {
    post({ type: "drowa:setEditMode", editMode });
  }, [editMode]);

  useEffect(() => {
    post({ type: "drowa:overrides", overrides });
  }, [overrides]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const data = e.data as
        | { type: "drowa:ready" }
        | { type: "drowa:selected"; payload: Selection }
        | { type: "drowa:deselected" }
        | { type: "drowa:moved"; id: string; transform: string }
        | { type: "drowa:error"; message: string; stack?: string; line?: number };
      if (!data || typeof data.type !== "string") return;

      if (data.type === "drowa:ready") {
        post({ type: "drowa:setEditMode", editMode: editModeRef.current });
        post({ type: "drowa:overrides", overrides: overridesRef.current });
      } else if (data.type === "drowa:selected") {
        onSelect(data.payload);
      } else if (data.type === "drowa:deselected") {
        onSelect(null);
      } else if (data.type === "drowa:moved") {
        onMove(data.id, data.transform);
      } else if (data.type === "drowa:error") {
        onError?.({ message: data.message, stack: data.stack, line: data.line });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onSelect, onMove, onError]);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background p-8 text-center">
        <div>
          <p className="serif text-xl italic text-foreground">Bundle failed</p>
          <p className="mt-2 max-w-lg font-mono text-[11px] leading-relaxed text-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (!srcDoc) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <div className="liquid-glass rounded-[8px] px-4 py-2 font-mono text-[11px] text-muted">
          Bundling front-end project...
        </div>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      title="preview"
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-same-origin"
      className="h-full w-full border-0 bg-white"
    />
  );
});
