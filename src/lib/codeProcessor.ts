// Preview-format normalizer.
//
// The preview iframe runs React UMD + Babel standalone and expects a bare
// `function App() { return (...) }` — no imports, no exports, hooks + React +
// Tailwind already global. AI output and templates sometimes use ES module
// syntax, which breaks that renderer. processForPreview strips it down.

export function processForPreview(code: string): string {
  let c = code;

  // 1. Strip every import statement (line-based; covers default + named).
  c = c.replace(/^[ \t]*import\b.*$/gm, "");

  // 2 + 3. Normalize exports → plain declarations, guaranteeing `function App`.
  //   - a default-exported function (named or anonymous) becomes App
  c = c.replace(/export\s+default\s+function\s+[A-Za-z0-9_]+/, "function App");
  c = c.replace(/export\s+default\s+function\s*\(/, "function App(");
  //   - `export default App;` / `export default Foo;` → drop (App defined above)
  c = c.replace(/export\s+default\s+[A-Za-z0-9_]+\s*;?/g, "");
  //   - `export default <expr>` (arrow etc.) → `const App = <expr>`
  c = c.replace(/export\s+default\s+/g, "const App = ");
  //   - named exports → plain declarations
  c = c.replace(/export\s+(function|const|let|var|class)\b/g, "$1");
  c = c.replace(/^[ \t]*export\s*\{[^}]*\};?[ \t]*$/gm, "");

  c = c.trim();

  // 4. Nothing named App but the body is bare JSX → wrap it.
  const hasApp = /\bfunction\s+App\b/.test(c) || /\bApp\s*=/.test(c);
  if (!hasApp && /^\s*</.test(c)) {
    c = `function App() {\n  return (\n${c}\n  );\n}`;
  }

  return c;
}
