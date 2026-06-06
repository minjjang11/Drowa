// Drowa-native multi-page convention.
//
// The legacy single-file surface `App.tsx` is the HOME page. Additional pages are
// stored as `pages/<slug>.tsx`. Imported real apps keep their own routing and do
// not use this convention (they run in WebContainer).

export const HOME_PATH = "App.tsx";

const PAGE_RE = /^pages\/([^/]+)\.[jt]sx?$/;

export function isPageFile(path: string): boolean {
  return path === HOME_PATH || PAGE_RE.test(path);
}

/** Route slug for a page file. Home → "index". `pages/about.tsx` → "about". */
export function pageSlug(path: string): string {
  if (path === HOME_PATH) return "index";
  const m = PAGE_RE.exec(path);
  return m ? m[1] : path;
}

/** Route path used by links/router. Home → "/". `pages/about.tsx` → "/about". */
export function pageRoute(path: string): string {
  const slug = pageSlug(path);
  return slug === "index" ? "/" : `/${slug}`;
}

/** Human label for the page switcher. */
export function pageLabel(path: string): string {
  const slug = pageSlug(path);
  if (slug === "index") return "Home";
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

/** File path for a slug. "index" → App.tsx, "about" → pages/about.tsx. */
export function pathForSlug(slug: string): string {
  const clean = slug.trim().toLowerCase().replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9-]/g, "-");
  if (!clean || clean === "index") return HOME_PATH;
  return `pages/${clean}.tsx`;
}

/** Sort page paths home-first, then alphabetically. */
export function sortPages(paths: string[]): string[] {
  return [...new Set(paths)].sort((a, b) => {
    if (a === HOME_PATH) return -1;
    if (b === HOME_PATH) return 1;
    return a.localeCompare(b);
  });
}

export interface PageMeta {
  path: string;
  slug: string;
  route: string;
  label: string;
}

export function pageMeta(path: string): PageMeta {
  return { path, slug: pageSlug(path), route: pageRoute(path), label: pageLabel(path) };
}

/** A stub page body for a freshly created page. */
export function newPageStub(label: string): string {
  return `function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f7f4]">
      <h1 className="text-3xl font-semibold text-[#0f0f0f]">${label}</h1>
    </div>
  );
}`;
}
