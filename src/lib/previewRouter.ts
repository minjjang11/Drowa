// In-preview client router for Drowa-native multi-page projects.
//
// Each page is a self-contained `function App()`. This builds a virtual esbuild
// entry that imports every page (via the `drowa-page:` specifier the bundler
// resolves) into a route table, then mounts a tiny router that swaps the rendered
// page on `data-drowa-link` / same-origin `<a href="/...">` clicks. The page AI is
// instructed to link with `data-drowa-link` (see lib/claude.ts).

export interface PreviewPage {
  /** Route path, e.g. "/" or "/about". */
  route: string;
  /** Project file path, e.g. "App.tsx" or "pages/about.tsx". */
  path: string;
}

export function buildRouterEntry(pages: PreviewPage[], initialRoute = "/"): string {
  const imports = pages.map((p, i) => `import __P${i} from "drowa-page:${p.path}";`).join("\n");
  const routes = pages.map((p, i) => `  ${JSON.stringify(p.route)}: __P${i},`).join("\n");
  return `import React from "react";
import { createRoot } from "react-dom/client";
${imports}

const __routes = {
${routes}
};
const __initialRoute = ${JSON.stringify(initialRoute)};

function __normalize(path) {
  if (!path) return "/";
  let p = String(path).split("?")[0].split("#")[0];
  if (p.length > 1 && p.endsWith("/")) p = p.replace(/\\/+$/, "");
  return p || "/";
}

function DrowaRouter() {
  const [route, setRoute] = React.useState(__initialRoute in __routes ? __initialRoute : "/");
  React.useEffect(function () {
    window.__drowaNav = function (to) { setRoute(__normalize(to)); };
    function onClick(e) {
      var link = e.target && e.target.closest ? e.target.closest("[data-drowa-link], a[href^='/']") : null;
      if (!link) return;
      var to = link.getAttribute("data-drowa-link") || link.getAttribute("href");
      if (!to || /^[a-z]+:/i.test(to) || to.indexOf("//") === 0) return;
      e.preventDefault();
      setRoute(__normalize(to));
    }
    document.addEventListener("click", onClick);
    return function () { document.removeEventListener("click", onClick); };
  }, []);
  var Page = __routes[route] || __routes["/"];
  if (!Page) return React.createElement("div", { style: { padding: 24, fontFamily: "monospace" } }, "No page at " + route);
  return React.createElement(Page);
}

createRoot(document.getElementById("root")).render(React.createElement(DrowaRouter));`;
}
