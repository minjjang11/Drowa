"use client";

import { useMemo } from "react";

/**
 * Renders the project's App component inside a sandboxed iframe.
 * Uses React UMD + Babel standalone from CDN so raw TSX/JSX runs client-side.
 * sandbox="allow-scripts" isolates it from the parent (no same-origin access).
 */
export function Preview({ code }: { code: string }) {
  const srcDoc = useMemo(() => buildSrcDoc(code), [code]);

  return (
    <iframe
      title="preview"
      srcDoc={srcDoc}
      sandbox="allow-scripts"
      className="h-full w-full border-0 bg-white"
    />
  );
}

function buildSrcDoc(code: string): string {
  // Normalize the export so we can mount <App /> after Babel transforms it.
  const normalized = code
    .replace(/export\s+default\s+function\s+App/, "function App")
    .replace(/export\s+default\s+App\s*;?/, "")
    .replace(/export\s+default\s+/, "const __Default = ");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <script src="https://cdn.tailwindcss.com"></script>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>html,body,#root{height:100%;margin:0;}</style>
  </head>
  <body>
    <div id="root"></div>
    <script type="text/babel" data-presets="react,typescript">
      try {
        ${normalized}
        const Root = typeof App !== "undefined" ? App : (typeof __Default !== "undefined" ? __Default : null);
        if (!Root) throw new Error("No component exported. Export a default 'App' component.");
        ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(Root));
      } catch (err) {
        document.getElementById("root").innerHTML =
          '<pre style="color:#b00;padding:16px;white-space:pre-wrap;font:13px ui-monospace,monospace">' +
          String(err && err.stack ? err.stack : err) + '</pre>';
      }
    </script>
  </body>
</html>`;
}
