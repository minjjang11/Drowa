export type TemplateCategory =
  | "hero"
  | "cards"
  | "pricing"
  | "forms"
  | "nav"
  | "dashboard"
  | "footer";

export interface Template {
  id: string;
  name: string;
  category: TemplateCategory;
  code: string;
  isGlobal?: boolean;
}

export const CATEGORIES: { id: TemplateCategory; label: string }[] = [
  { id: "hero", label: "Hero" },
  { id: "cards", label: "Cards" },
  { id: "pricing", label: "Pricing" },
  { id: "forms", label: "Forms" },
  { id: "nav", label: "Nav" },
  { id: "dashboard", label: "Dashboard" },
  { id: "footer", label: "Footer" },
];

const serif = `style={{ fontFamily: "'Playfair Display', serif" }}`;

/**
 * Built-in templates. Each defines a single `function Section()` returning a
 * self-contained section, styled to the Drowa warm-dark design tokens. The
 * insert flow renames `Section` to a unique id and composes it into App.
 */
export const BUILTIN_TEMPLATES: Template[] = [
  // ── Hero ──────────────────────────────────────────────
  {
    id: "hero-split",
    name: "Split",
    category: "hero",
    code: `function Section() {
  return (
    <section className="bg-[#0d0d0d] px-8 py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
        <div>
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-[#f59e0b]">Introducing</p>
          <h1 className="text-5xl leading-tight text-[#f5f5f0]" ${serif}>Build something <span className="italic text-[#ec4899]">remarkable</span></h1>
          <p className="mt-5 max-w-md text-[#888880]">A premium starting point for your next idea — crafted, fast, and ready to ship.</p>
          <div className="mt-8 flex gap-3">
            <button className="rounded-[8px] bg-[#f59e0b] px-5 py-2.5 text-sm font-medium text-[#0d0d0d]">Get started</button>
            <button className="rounded-[8px] border border-[#2a2a2a] px-5 py-2.5 text-sm text-[#f5f5f0]">Learn more</button>
          </div>
        </div>
        <div className="aspect-[4/3] rounded-[12px] border border-[#2a2a2a] bg-gradient-to-br from-[#1a1a1a] via-[#141414] to-[#0d0d0d]" />
      </div>
    </section>
  );
}`,
  },
  {
    id: "hero-centered",
    name: "Centered",
    category: "hero",
    code: `function Section() {
  return (
    <section className="bg-[#0d0d0d] px-8 py-28 text-center">
      <div className="mx-auto max-w-2xl">
        <span className="rounded-[9999px] border border-[#2a2a2a] px-3 py-1 font-mono text-[11px] text-[#888880]">v1.0 is live</span>
        <h1 className="mt-6 text-6xl leading-tight text-[#f5f5f0]" ${serif}>Ship faster, <span className="italic text-[#f59e0b]">together</span></h1>
        <p className="mx-auto mt-5 max-w-lg text-[#888880]">The collaborative build platform for teams who care about craft.</p>
        <button className="mt-8 rounded-[8px] bg-[#f59e0b] px-6 py-3 text-sm font-medium text-[#0d0d0d]">Start building</button>
      </div>
    </section>
  );
}`,
  },
  // ── Cards ─────────────────────────────────────────────
  {
    id: "cards-feature-grid",
    name: "Feature grid",
    category: "cards",
    code: `function Section() {
  const items = [
    { t: "Fast", d: "Instant feedback as you build." },
    { t: "Shared", d: "One context, two minds." },
    { t: "Premium", d: "Looks great by default." },
  ];
  return (
    <section className="bg-[#0d0d0d] px-8 py-20">
      <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
        {items.map((it, i) => (
          <div key={i} className="rounded-[12px] border border-[#2a2a2a] bg-[#141414] p-6">
            <div className="mb-4 h-9 w-9 rounded-[8px] bg-[#f59e0b]/20" />
            <h3 className="text-lg text-[#f5f5f0]" ${serif}>{it.t}</h3>
            <p className="mt-2 text-sm text-[#888880]">{it.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}`,
  },
  {
    id: "cards-layered",
    name: "Layered card",
    category: "cards",
    code: `function Section() {
  return (
    <section className="bg-[#0d0d0d] px-8 py-20">
      <div className="mx-auto max-w-md">
        <div className="relative">
          <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-[12px] bg-[#ec4899]/20" />
          <div className="relative overflow-hidden rounded-[12px] border border-[#2a2a2a] bg-[#141414]">
            <div className="aspect-video bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d]" />
            <div className="p-5">
              <h3 className="text-xl text-[#f5f5f0]" ${serif}>Layered depth</h3>
              <p className="mt-2 text-sm text-[#888880]">An offset shadow card that feels tactile and premium.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}`,
  },
  // ── Pricing ───────────────────────────────────────────
  {
    id: "pricing-two-tier",
    name: "Two-tier",
    category: "pricing",
    code: `function Section() {
  return (
    <section className="bg-[#0d0d0d] px-8 py-20">
      <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
        {[{n:"Free",p:"$0",f:["1 project","Community support"]},{n:"Pro",p:"$19",f:["Unlimited projects","Priority support","Custom domain"]}].map((t,i)=>(
          <div key={i} className="rounded-[12px] border border-[#2a2a2a] bg-[#141414] p-6">
            <h3 className="text-lg text-[#f5f5f0]" ${serif}>{t.n}</h3>
            <p className="mt-2 text-3xl font-semibold text-[#f5f5f0]">{t.p}<span className="text-sm text-[#888880]">/mo</span></p>
            <ul className="mt-4 space-y-2 text-sm text-[#888880]">{t.f.map((x,j)=>(<li key={j}>— {x}</li>))}</ul>
            <button className="mt-6 w-full rounded-[8px] border border-[#2a2a2a] py-2 text-sm text-[#f5f5f0]">Choose</button>
          </div>
        ))}
      </div>
    </section>
  );
}`,
  },
  {
    id: "pricing-three-tier",
    name: "Three-tier",
    category: "pricing",
    code: `function Section() {
  const tiers = [
    { n: "Starter", p: "$0", hi: false },
    { n: "Pro", p: "$19", hi: true },
    { n: "Team", p: "$49", hi: false },
  ];
  return (
    <section className="bg-[#0d0d0d] px-8 py-20">
      <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-3">
        {tiers.map((t, i) => (
          <div key={i} className={"rounded-[12px] p-6 " + (t.hi ? "border-2 border-[#f59e0b] bg-[#1a1a1a]" : "border border-[#2a2a2a] bg-[#141414]")}>
            {t.hi && <span className="font-mono text-[10px] uppercase tracking-widest text-[#f59e0b]">Recommended</span>}
            <h3 className="mt-1 text-lg text-[#f5f5f0]" ${serif}>{t.n}</h3>
            <p className="mt-2 text-3xl font-semibold text-[#f5f5f0]">{t.p}</p>
            <button className={"mt-6 w-full rounded-[8px] py-2 text-sm " + (t.hi ? "bg-[#f59e0b] text-[#0d0d0d]" : "border border-[#2a2a2a] text-[#f5f5f0]")}>Select</button>
          </div>
        ))}
      </div>
    </section>
  );
}`,
  },
  // ── Forms ─────────────────────────────────────────────
  {
    id: "forms-contact",
    name: "Contact",
    category: "forms",
    code: `function Section() {
  return (
    <section className="bg-[#0d0d0d] px-8 py-20">
      <div className="mx-auto max-w-md">
        <h2 className="text-3xl text-[#f5f5f0]" ${serif}>Get in touch</h2>
        <form className="mt-6 space-y-3">
          <input placeholder="Name" className="w-full rounded-[8px] border border-[#2a2a2a] bg-[#141414] px-3 py-2.5 text-sm text-[#f5f5f0] outline-none" />
          <input placeholder="Email" className="w-full rounded-[8px] border border-[#2a2a2a] bg-[#141414] px-3 py-2.5 text-sm text-[#f5f5f0] outline-none" />
          <textarea placeholder="Message" rows={4} className="w-full rounded-[8px] border border-[#2a2a2a] bg-[#141414] px-3 py-2.5 text-sm text-[#f5f5f0] outline-none" />
          <button className="w-full rounded-[8px] bg-[#f59e0b] py-2.5 text-sm font-medium text-[#0d0d0d]">Send message</button>
        </form>
      </div>
    </section>
  );
}`,
  },
  {
    id: "forms-waitlist",
    name: "Waitlist",
    category: "forms",
    code: `function Section() {
  return (
    <section className="bg-[#0d0d0d] px-8 py-24 text-center">
      <div className="mx-auto max-w-md">
        <h2 className="text-4xl text-[#f5f5f0]" ${serif}>Join the <span className="italic text-[#f59e0b]">waitlist</span></h2>
        <p className="mt-3 text-sm text-[#888880]">Be the first to know when we launch.</p>
        <div className="mt-6 flex gap-2">
          <input placeholder="you@email.com" className="flex-1 rounded-[8px] border border-[#2a2a2a] bg-[#141414] px-3 py-2.5 text-sm text-[#f5f5f0] outline-none" />
          <button className="rounded-[8px] bg-[#f59e0b] px-5 text-sm font-medium text-[#0d0d0d]">Notify me</button>
        </div>
      </div>
    </section>
  );
}`,
  },
  // ── Nav ───────────────────────────────────────────────
  {
    id: "nav-minimal",
    name: "Minimal",
    category: "nav",
    code: `function Section() {
  return (
    <nav className="flex items-center justify-between border-b border-[#2a2a2a] bg-[#0d0d0d] px-8 py-4">
      <span className="text-lg text-[#f5f5f0]" ${serif}>Drowa</span>
      <div className="flex gap-6 font-mono text-sm text-[#888880]">
        <a className="hover:text-[#f5f5f0]">Product</a>
        <a className="hover:text-[#f5f5f0]">Pricing</a>
        <a className="hover:text-[#f5f5f0]">About</a>
      </div>
    </nav>
  );
}`,
  },
  {
    id: "nav-cta",
    name: "With CTA",
    category: "nav",
    code: `function Section() {
  return (
    <nav className="flex items-center justify-between border-b border-[#2a2a2a] bg-[#0d0d0d] px-8 py-4">
      <span className="text-lg text-[#f5f5f0]" ${serif}>Drowa</span>
      <div className="flex items-center gap-6">
        <div className="flex gap-6 font-mono text-sm text-[#888880]">
          <a className="hover:text-[#f5f5f0]">Features</a>
          <a className="hover:text-[#f5f5f0]">Docs</a>
        </div>
        <button className="rounded-[8px] bg-[#f59e0b] px-4 py-2 text-sm font-medium text-[#0d0d0d]">Sign up</button>
      </div>
    </nav>
  );
}`,
  },
  // ── Dashboard ─────────────────────────────────────────
  {
    id: "dashboard-stats",
    name: "Stats row",
    category: "dashboard",
    code: `function Section() {
  const stats = [
    { l: "Revenue", v: "$48.2k" },
    { l: "Users", v: "1,284" },
    { l: "Active", v: "92%" },
    { l: "Churn", v: "1.4%" },
  ];
  return (
    <section className="bg-[#0d0d0d] px-8 py-12">
      <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div key={i} className="rounded-[12px] border border-[#2a2a2a] bg-[#141414] p-5">
            <div className="mb-3 h-8 w-8 rounded-[8px] bg-[#ec4899]/20" />
            <p className="font-mono text-[11px] uppercase tracking-wider text-[#888880]">{s.l}</p>
            <p className="mt-1 text-2xl font-semibold text-[#f5f5f0]">{s.v}</p>
          </div>
        ))}
      </div>
    </section>
  );
}`,
  },
  {
    id: "dashboard-sidebar",
    name: "Sidebar layout",
    category: "dashboard",
    code: `function Section() {
  return (
    <section className="flex min-h-[420px] bg-[#0d0d0d]">
      <aside className="w-52 border-r border-[#2a2a2a] bg-[#141414] p-4">
        <span className="text-base text-[#f5f5f0]" ${serif}>Drowa</span>
        <nav className="mt-6 space-y-1 font-mono text-sm">
          {["Overview","Projects","Team","Settings"].map((x,i)=>(
            <a key={i} className={"block rounded-[8px] px-3 py-2 " + (i===0 ? "bg-[#1a1a1a] text-[#f59e0b]" : "text-[#888880] hover:text-[#f5f5f0]")}>{x}</a>
          ))}
        </nav>
      </aside>
      <div className="flex-1 p-8">
        <h2 className="text-2xl text-[#f5f5f0]" ${serif}>Overview</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="h-28 rounded-[12px] border border-[#2a2a2a] bg-[#141414]" />
          <div className="h-28 rounded-[12px] border border-[#2a2a2a] bg-[#141414]" />
        </div>
      </div>
    </section>
  );
}`,
  },
  // ── Footer ────────────────────────────────────────────
  {
    id: "footer-simple",
    name: "Simple",
    category: "footer",
    code: `function Section() {
  return (
    <footer className="border-t border-[#2a2a2a] bg-[#0d0d0d] px-8 py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
        <span className="text-base text-[#f5f5f0]" ${serif}>Drowa</span>
        <div className="flex gap-5 font-mono text-sm text-[#888880]">
          <a className="hover:text-[#f5f5f0]">Privacy</a>
          <a className="hover:text-[#f5f5f0]">Terms</a>
          <a className="hover:text-[#f5f5f0]">Contact</a>
        </div>
        <span className="font-mono text-xs text-[#888880]">© 2026 Drowa</span>
      </div>
    </footer>
  );
}`,
  },
  {
    id: "footer-full",
    name: "Full",
    category: "footer",
    code: `function Section() {
  const cols = [
    { h: "Product", l: ["Features","Pricing","Changelog"] },
    { h: "Company", l: ["About","Blog","Careers"] },
    { h: "Resources", l: ["Docs","Support","API"] },
  ];
  return (
    <footer className="border-t border-[#2a2a2a] bg-[#0d0d0d] px-8 py-12">
      <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <span className="text-lg text-[#f5f5f0]" ${serif}>Drowa</span>
          <p className="mt-2 text-sm text-[#888880]">Build together. Ship faster.</p>
        </div>
        {cols.map((c, i) => (
          <div key={i}>
            <p className="font-mono text-[11px] uppercase tracking-wider text-[#f59e0b]">{c.h}</p>
            <ul className="mt-3 space-y-2 text-sm text-[#888880]">{c.l.map((x,j)=>(<li key={j} className="hover:text-[#f5f5f0]">{x}</li>))}</ul>
          </div>
        ))}
      </div>
    </footer>
  );
}`,
  },
];

/** Suggested one-click refine prompts shown after a template insert. */
export const REFINE_PROMPTS = [
  "Make it more minimal",
  "Make it full-width",
  "Match our design system",
  "Add animations",
];

/** Wrap the current file's default export into a `function Section` so it can be saved + re-inserted. */
export function toTemplateCode(code: string): string {
  let body = code;
  let name = "__SavedRoot";

  const fnMatch = /export\s+default\s+function\s+([A-Za-z0-9_]+)/.exec(code);
  const idMatch = /export\s+default\s+([A-Za-z0-9_]+)\s*;?/.exec(code);

  if (fnMatch) {
    body = code.replace(/export\s+default\s+function\s+[A-Za-z0-9_]+/, "function __SavedRoot");
  } else if (idMatch) {
    name = idMatch[1];
    body = code.replace(/export\s+default\s+[A-Za-z0-9_]+\s*;?/, "");
  } else {
    body = code.replace(/export\s+default\s+/, "const __SavedRoot = ");
  }

  return `${body}\n\nfunction Section() {\n  return <${name} />;\n}`;
}

/**
 * Compose a template into the current file. Strips the current default export,
 * appends the template as a uniquely-named component, and emits a new root that
 * renders the previous tree followed by the new section. Always renders + stacks.
 */
export function insertTemplate(code: string, templateCode: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const uid = `Tpl_${rand}`;
  const rootId = `Root_${rand}`;
  const tmpl = templateCode.replace(/function\s+Section\b/, `function ${uid}`);

  let prev = code;
  let prevName: string;

  const fnMatch = /export\s+default\s+function\s+([A-Za-z0-9_]+)/.exec(code);
  const idMatch = /export\s+default\s+([A-Za-z0-9_]+)\s*;?/.exec(code);

  if (fnMatch) {
    prevName = fnMatch[1];
    prev = code.replace(/export\s+default\s+function/, "function");
  } else if (idMatch) {
    prevName = idMatch[1];
    prev = code.replace(/export\s+default\s+[A-Za-z0-9_]+\s*;?/, "");
  } else {
    prevName = `${rootId}_prev`;
    prev = code.replace(/export\s+default\s+/, `const ${prevName} = `);
  }

  return `${prev}\n\n${tmpl}\n\nexport default function ${rootId}() {
  return (
    <>
      <${prevName} />
      <${uid} />
    </>
  );
}
`;
}
