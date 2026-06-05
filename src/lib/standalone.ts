// P2 — Deploy: produce a single self-contained index.html that runs the
// project anywhere (drag to Netlify Drop, any static host). No build step,
// no server — React UMD + Tailwind CDN + Babel inline, same runtime the
// preview iframe uses, minus the editor instrumentation.

import { processForPreview } from "./codeProcessor";

export function buildStandaloneHtml(code: string, title = "Drowa app"): string {
  const app = processForPreview(code);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title.replace(/</g, "&lt;")}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link crossorigin href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
    <script crossorigin src="https://cdn.tailwindcss.com"></script>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>html,body,#root{height:100%;margin:0;}body{background:#f8f7f4;color:#0f0f0f;font-family:"Geist",ui-sans-serif,system-ui;}</style>
  </head>
  <body>
    <div id="root"></div>
    <script type="text/babel" data-presets="react,typescript">
      const { useState, useEffect, useRef, useMemo, useCallback, useReducer, useContext, Fragment } = React;
      ${app}
      const Root = typeof App !== "undefined" ? App : null;
      if (Root) {
        ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(Root));
      } else {
        document.getElementById("root").innerHTML = "<pre style='padding:16px;font:13px monospace'>No App component found.</pre>";
      }
    </script>
  </body>
</html>`;
}
