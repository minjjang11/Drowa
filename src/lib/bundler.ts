// P0 — Preview bundler.
//
// The iframe can only run ONE self-contained file. Real projects (GitHub
// imports) have many files + local imports. bundleProject inlines every local
// import into a single module the iframe can always render:
//   - resolve `./x`, `../x`, `@/x` imports → paste that file's code
//   - strip external imports (react, npm pkgs) — React/hooks are global in the
//     iframe; unknown externals are dropped (best-effort)
//   - drop CSS/asset imports
//   - normalize exports so a `function App` always exists
//
// Best-effort, not a real bundler: it does not rename to avoid name collisions
// across modules, and it cannot resolve npm component libraries. It covers the
// common case — a handful of local component files + React + Tailwind.

import { processForPreview } from "./codeProcessor";

type FileMap = Record<string, string>;

const ENTRY_CANDIDATES = [
  "App.tsx",
  "App.jsx",
  "src/App.tsx",
  "src/App.jsx",
  "src/main.tsx",
  "src/main.jsx",
  "src/index.tsx",
  "src/index.jsx",
  "index.tsx",
];

/** Pick the entry file: a known candidate, else the first file with a default export. */
export function pickEntry(files: FileMap): string {
  for (const c of ENTRY_CANDIDATES) if (files[c] != null) return c;
  const withDefault = Object.keys(files).find(
    (p) => /\.[jt]sx?$/.test(p) && /export\s+default/.test(files[p]),
  );
  return withDefault ?? Object.keys(files)[0] ?? "App.tsx";
}

function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const seg of path.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

/** Resolve a local import spec to a file path in the map, or null if external. */
function resolveImport(spec: string, fromPath: string, files: FileMap): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = "src/" + spec.slice(2);
  else if (spec.startsWith(".")) {
    const dir = fromPath.includes("/") ? fromPath.slice(0, fromPath.lastIndexOf("/")) : "";
    base = normalizePath((dir ? dir + "/" : "") + spec);
  } else return null; // bare specifier → external package

  const exts = ["", ".tsx", ".ts", ".jsx", ".js"];
  for (const e of exts) if (files[base + e] != null) return base + e;
  for (const e of [".tsx", ".ts", ".jsx", ".js"]) if (files[base + "/index" + e] != null) return base + "/index" + e;
  return null;
}

/** Parse an import clause into default name, named bindings, and namespace name. */
function parseClause(clause: string): {
  def: string | null;
  named: { name: string; alias: string }[];
  ns: string | null;
} {
  const out = { def: null as string | null, named: [] as { name: string; alias: string }[], ns: null as string | null };
  let c = clause.trim();

  const nsMatch = /\*\s+as\s+([A-Za-z0-9_$]+)/.exec(c);
  if (nsMatch) out.ns = nsMatch[1];

  const braceMatch = /\{([^}]*)\}/.exec(c);
  if (braceMatch) {
    for (const part of braceMatch[1].split(",")) {
      const p = part.trim();
      if (!p) continue;
      const as = /([A-Za-z0-9_$]+)\s+as\s+([A-Za-z0-9_$]+)/.exec(p);
      if (as) out.named.push({ name: as[1], alias: as[2] });
      else out.named.push({ name: p, alias: p });
    }
    c = c.replace(braceMatch[0], "");
  }

  const defMatch = /^\s*([A-Za-z0-9_$]+)\s*,?/.exec(c);
  if (defMatch && defMatch[1] !== "as") out.def = defMatch[1];
  return out;
}

export function bundleProject(
  fileList: { path: string; content: string }[],
  entryArg?: string,
): string {
  const files: FileMap = {};
  for (const f of fileList) files[f.path] = f.content;
  const entry = entryArg && files[entryArg] != null ? entryArg : pickEntry(files);

  const emitted = new Set<string>();
  const defaultRef = new Map<string, string | null>();
  const out: string[] = [];
  let counter = 0;

  function process(path: string): string | null {
    if (emitted.has(path)) return defaultRef.get(path) ?? null;
    emitted.add(path);
    let src = files[path] ?? "";
    const aliases: string[] = [];

    // `import Default, { A as B } from './x'` / `import * as NS from './x'`
    src = src.replace(
      /^[ \t]*import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?[ \t]*$/gm,
      (_m, clause: string, spec: string) => {
        const resolved = resolveImport(spec, path, files);
        if (!resolved) return ""; // external → drop
        const depDefault = process(resolved);
        const { def, named, ns } = parseClause(clause);
        if (def && depDefault && def !== depDefault) aliases.push(`const ${def} = ${depDefault};`);
        for (const n of named) if (n.name !== n.alias) aliases.push(`const ${n.alias} = ${n.name};`);
        if (ns) aliases.push(`const ${ns} = {};`); // namespace not fully supported
        return "";
      },
    );
    // side-effect / asset imports: `import './x.css'`, `import logo from './a.png'`
    src = src.replace(/^[ \t]*import\s+['"][^'"]+['"];?[ \t]*$/gm, "");
    src = src.replace(/^[ \t]*import\b.*$/gm, ""); // any leftover external import

    let def: string | null = null;
    src = src.replace(/export\s+default\s+function\s+([A-Za-z0-9_$]+)/, (_m, n) => {
      def = n;
      return "function " + n;
    });
    src = src.replace(/export\s+default\s+function\s*\(/, () => {
      def = "__def_" + counter++;
      return "function " + def + "(";
    });
    src = src.replace(/export\s+default\s+class\s+([A-Za-z0-9_$]+)/, (_m, n) => {
      def = n;
      return "class " + n;
    });
    src = src.replace(/export\s+default\s+([A-Za-z0-9_$]+)\s*;?/, (_m, n) => {
      def = n;
      return "";
    });
    src = src.replace(/export\s+default\s+/, () => {
      def = "__def_" + counter++;
      return "const " + def + " = ";
    });
    src = src.replace(/export\s+(function|const|let|var|class)\b/g, "$1");
    src = src.replace(/^[ \t]*export\s*\{[^}]*\};?[ \t]*$/gm, "");

    defaultRef.set(path, def);
    // No comment / leading newline: keeps the entry file's line numbers intact
    // for single-file projects (3-7 visual↔code mapping).
    out.push(`${aliases.length ? aliases.join("\n") + "\n" : ""}${src.trim()}`);
    return def;
  }

  process(entry);

  let merged = out.join("\n");
  const entryDefault = defaultRef.get(entry);
  if (entryDefault && entryDefault !== "App" && !/\bfunction\s+App\b|\bApp\s*=/.test(merged)) {
    merged += `\nconst App = ${entryDefault};\n`;
  }
  // Final safety: strip stray imports/exports + guarantee App.
  return processForPreview(merged);
}
