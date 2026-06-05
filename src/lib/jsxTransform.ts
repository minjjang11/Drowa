// Phase 3-7 — Visual ↔ Code linking.
//
// Lightweight regex-based JSX transforms. No babel dependency on the server:
// the spec explicitly allows a "regex fallback". These functions never add or
// remove newlines, so a source line number is identical before and after
// injectLineAttrs — which is what keeps the iframe DOM, the code panel, and the
// block-extraction below all pointing at the same line.

/**
 * Tag every opening JSX element with data-drowa-line="<1-based source line>".
 * Host elements (lowercase) forward data-* to the DOM, so the in-iframe click
 * listener can read the source line straight off the clicked node.
 */
export function injectLineAttrs(code: string): string {
  let out = "";
  let line = 1;
  let last = 0;
  // Opening tags only: <div, <Button — not </div and not <> fragments.
  const re = /<([A-Za-z][A-Za-z0-9.]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    const seg = code.slice(last, m.index);
    for (let i = 0; i < seg.length; i++) if (seg[i] === "\n") line++;
    out += seg + m[0] + ` data-drowa-line="${line}"`;
    last = re.lastIndex;
  }
  return out + code.slice(last);
}

/** Find the index of the `>` that closes the opening tag starting at `from`. */
function findTagEnd(code: string, from: number): number {
  let quote: string | null = null;
  let brace = 0;
  for (let j = from; j < code.length; j++) {
    const c = code[j];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "{") brace++;
    else if (c === "}") brace--;
    else if (c === ">" && brace === 0) return j;
  }
  return code.length - 1;
}

export interface JsxBlock {
  /** Char offset of the opening `<`. */
  start: number;
  /** Char offset just past the element (exclusive). */
  end: number;
  /** The element's full source text. */
  block: string;
  /** Leading whitespace of the element's first line, for re-indenting copies. */
  indent: string;
}

/**
 * Extract the full JSX element whose opening tag sits on `line` (1-based).
 * Walks a tag-depth counter so nested same-named elements match correctly, and
 * handles self-closing tags. Returns null if no opening tag is found on/after
 * that line.
 */
export function extractJsxBlock(code: string, line: number): JsxBlock | null {
  if (!line || line < 1) return null;

  // Offset of the start of `line`.
  let lineStart = 0;
  let cur = 1;
  while (cur < line && lineStart < code.length) {
    const nl = code.indexOf("\n", lineStart);
    if (nl === -1) return null;
    lineStart = nl + 1;
    cur++;
  }

  // First opening tag at/after lineStart.
  const open = /<[A-Za-z]/g;
  open.lastIndex = lineStart;
  const first = open.exec(code);
  if (!first) return null;
  const start = first.index;

  // Indentation of the element's first line.
  const lineHead = code.lastIndexOf("\n", start) + 1;
  const indent = (code.slice(lineHead, start).match(/^\s*/) ?? [""])[0];

  let i = start;
  let depth = 0;
  while (i < code.length) {
    if (code[i] === "<") {
      if (code[i + 1] === "/") {
        depth--;
        const gt = code.indexOf(">", i);
        const endIdx = (gt === -1 ? code.length : gt) + 1;
        if (depth === 0) return { start, end: endIdx, block: code.slice(start, endIdx), indent };
        i = endIdx;
        continue;
      }
      if (/[A-Za-z]/.test(code[i + 1] ?? "")) {
        const gt = findTagEnd(code, i);
        const selfClose = code[gt - 1] === "/";
        if (selfClose) {
          if (depth === 0) return { start, end: gt + 1, block: code.slice(start, gt + 1), indent };
        } else {
          depth++;
        }
        i = gt + 1;
        continue;
      }
    }
    i++;
  }
  return null;
}

/** Insert `snippet` (a JSX element) right after `block`, re-indented to match. */
export function insertAfterBlock(code: string, block: JsxBlock, snippet: string): string {
  const reindented = snippet
    .trim()
    .split("\n")
    .map((l, idx) => (idx === 0 ? block.indent + l : l))
    .join("\n");
  return code.slice(0, block.end) + "\n" + reindented + code.slice(block.end);
}

/** Remove `block` from the source, collapsing the blank line it leaves behind. */
export function removeBlock(code: string, block: JsxBlock): string {
  let before = code.slice(0, block.start);
  let after = code.slice(block.end);
  // Drop the now-empty line the element used to occupy.
  before = before.replace(/[ \t]*$/, "");
  if (before.endsWith("\n") && /^[ \t]*\n/.test(after)) after = after.replace(/^[ \t]*\n/, "");
  return before + after;
}
