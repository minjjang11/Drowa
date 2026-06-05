// Phase: Home redesign — full-page gallery templates (distinct from the
// section-level BUILTIN_TEMPLATES used by the in-editor TemplateLibrary).
// Each `code` is a complete, self-contained `export default function App`
// on the Drowa warm-dark design tokens. "Use this" seeds it as the project's
// App.tsx with no AI round-trip.

export type GalleryCategory =
  | "landing"
  | "dashboard"
  | "ecommerce"
  | "components"
  | "portfolio";

export interface PageTemplate {
  id: string;
  name: string;
  category: GalleryCategory;
  tags?: string[];
  /** Higher = more popular; drives the "Popular" sort. */
  popularity: number;
  code: string;
}

export const GALLERY_FILTERS: { id: GalleryCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "landing", label: "Landing" },
  { id: "dashboard", label: "Dashboard" },
  { id: "portfolio", label: "Portfolio" },
  { id: "ecommerce", label: "E-commerce" },
  { id: "components", label: "Components" },
];

const CAT_LABEL: Record<GalleryCategory, string> = {
  landing: "Landing",
  dashboard: "Dashboard",
  ecommerce: "E-commerce",
  components: "Components",
  portfolio: "Portfolio",
};

export function categoryLabel(c: GalleryCategory): string {
  return CAT_LABEL[c];
}

const serif = `style={{ fontFamily: "'Playfair Display', serif" }}`;

export const PAGE_TEMPLATES: PageTemplate[] = [
  // ── Landing (5) ─────────────────────────────────────────
  {
    id: "landing-minimal-saas",
    name: "Minimal SaaS",
    category: "landing",
    tags: ["Multi page"],
    popularity: 98,
    code: `export default function App() {
  const features = [
    { t: "Fast", d: "Instant feedback as you build." },
    { t: "Shared", d: "One context, two minds." },
    { t: "Premium", d: "Looks great by default." },
  ];
  const tiers = [
    { n: "Starter", p: "$0", hi: false },
    { n: "Pro", p: "$19", hi: true },
    { n: "Team", p: "$49", hi: false },
  ];
  return (
    <div className="min-h-screen bg-[#0d0d0d] text-[#f5f5f0]">
      <nav className="flex items-center justify-between border-b border-[#2a2a2a] px-8 py-4">
        <span className="text-lg" ${serif}>Nimbus</span>
        <div className="flex items-center gap-6 font-mono text-sm text-[#888880]">
          <a className="hover:text-[#f5f5f0]">Features</a>
          <a className="hover:text-[#f5f5f0]">Pricing</a>
          <button className="rounded-[8px] bg-[#f59e0b] px-4 py-2 text-[#0d0d0d]">Sign up</button>
        </div>
      </nav>
      <section className="px-8 py-28 text-center">
        <span className="rounded-[9999px] border border-[#2a2a2a] px-3 py-1 font-mono text-[11px] text-[#888880]">v1.0 is live</span>
        <h1 className="mx-auto mt-6 max-w-2xl text-6xl leading-tight" ${serif}>Ship faster, <span className="italic text-[#f59e0b]">together</span></h1>
        <p className="mx-auto mt-5 max-w-lg text-[#888880]">The collaborative build platform for teams who care about craft.</p>
        <button className="mt-8 rounded-[8px] bg-[#f59e0b] px-6 py-3 text-sm font-medium text-[#0d0d0d]">Start building</button>
      </section>
      <section className="px-8 py-16">
        <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
          {features.map((f, i) => (
            <div key={i} className="rounded-[12px] border border-[#2a2a2a] bg-[#141414] p-6">
              <div className="mb-4 h-9 w-9 rounded-[8px] bg-[#f59e0b]/20" />
              <h3 className="text-lg" ${serif}>{f.t}</h3>
              <p className="mt-2 text-sm text-[#888880]">{f.d}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="px-8 py-16">
        <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-3">
          {tiers.map((t, i) => (
            <div key={i} className={"rounded-[12px] p-6 " + (t.hi ? "border-2 border-[#f59e0b] bg-[#1a1a1a]" : "border border-[#2a2a2a] bg-[#141414]")}>
              {t.hi && <span className="font-mono text-[10px] uppercase tracking-widest text-[#f59e0b]">Recommended</span>}
              <h3 className="mt-1 text-lg" ${serif}>{t.n}</h3>
              <p className="mt-2 text-3xl font-semibold">{t.p}<span className="text-sm text-[#888880]">/mo</span></p>
              <button className={"mt-6 w-full rounded-[8px] py-2 text-sm " + (t.hi ? "bg-[#f59e0b] text-[#0d0d0d]" : "border border-[#2a2a2a]")}>Choose</button>
            </div>
          ))}
        </div>
      </section>
      <footer className="border-t border-[#2a2a2a] px-8 py-8 text-center font-mono text-xs text-[#888880]">© 2026 Nimbus</footer>
    </div>
  );
}`,
  },
  {
    id: "landing-bold-agency",
    name: "Bold Agency",
    category: "landing",
    tags: ["Editorial"],
    popularity: 81,
    code: `export default function App() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] text-[#f5f5f0]">
      <nav className="flex items-center justify-between px-10 py-6">
        <span className="text-xl" ${serif}>STUDIO⁄FORM</span>
        <span className="font-mono text-xs text-[#888880]">EST. 2026</span>
      </nav>
      <section className="px-10 py-20">
        <h1 className="text-[12vw] leading-[0.9] tracking-tight" ${serif}>We make<br /><span className="italic text-[#ec4899]">brands</span> move.</h1>
        <div className="mt-12 flex flex-wrap items-end justify-between gap-6">
          <p className="max-w-md text-lg text-[#888880]">An independent design studio crafting editorial identities for ambitious companies.</p>
          <button className="rounded-[9999px] border border-[#f59e0b] px-8 py-3 font-mono text-sm text-[#f59e0b] hover:bg-[#f59e0b] hover:text-[#0d0d0d]">View work →</button>
        </div>
      </section>
      <section className="grid gap-1 px-1 pb-1 md:grid-cols-3">
        {[1,2,3].map((i)=>(
          <div key={i} className="aspect-[3/4] bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d]" />
        ))}
      </section>
    </div>
  );
}`,
  },
  {
    id: "landing-product-hunt",
    name: "Product Hunt Launch",
    category: "landing",
    tags: ["Single page", "Conversion"],
    popularity: 74,
    code: `export default function App() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] px-8 py-20 text-center text-[#f5f5f0]">
      <div className="mx-auto max-w-xl">
        <span className="rounded-[9999px] bg-[#f59e0b]/15 px-3 py-1 font-mono text-[11px] text-[#f59e0b]">🚀 Launching today</span>
        <h1 className="mt-6 text-5xl leading-tight" ${serif}>The fastest way to <span className="italic text-[#f59e0b]">build</span></h1>
        <p className="mt-4 text-[#888880]">Join 2,400+ makers shipping with our tool. Support us on launch day.</p>
        <div className="mt-8 flex justify-center gap-3">
          <button className="rounded-[8px] bg-[#f59e0b] px-6 py-3 text-sm font-medium text-[#0d0d0d]">Upvote ▲ 312</button>
          <button className="rounded-[8px] border border-[#2a2a2a] px-6 py-3 text-sm">Get early access</button>
        </div>
        <div className="mx-auto mt-12 aspect-video max-w-lg rounded-[12px] border border-[#2a2a2a] bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d]" />
      </div>
    </div>
  );
}`,
  },
  {
    id: "landing-waitlist",
    name: "Waitlist",
    category: "landing",
    tags: ["Ultra minimal"],
    popularity: 69,
    code: `export default function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d0d0d] px-8 text-center text-[#f5f5f0]">
      <div className="max-w-md">
        <div className="mx-auto mb-6 h-12 w-12 rounded-[12px] bg-gradient-to-br from-[#f59e0b] to-[#ec4899]" />
        <h1 className="text-4xl" ${serif}>Join the <span className="italic text-[#f59e0b]">waitlist</span></h1>
        <p className="mt-3 text-sm text-[#888880]">Be the first to know when we launch. No spam, ever.</p>
        <div className="mt-6 flex gap-2">
          <input placeholder="you@email.com" className="flex-1 rounded-[8px] border border-[#2a2a2a] bg-[#141414] px-3 py-2.5 text-sm outline-none" />
          <button className="rounded-[8px] bg-[#f59e0b] px-5 text-sm font-medium text-[#0d0d0d]">Notify me</button>
        </div>
        <p className="mt-4 font-mono text-[11px] text-[#888880]">1,284 people ahead of you</p>
      </div>
    </div>
  );
}`,
  },
  {
    id: "landing-dev-portfolio",
    name: "Developer Portfolio",
    category: "landing",
    tags: ["Monospace"],
    popularity: 77,
    code: `export default function App() {
  const projects = [
    { n: "orbit-cli", d: "Terminal task runner", s: "Rust" },
    { n: "drowa", d: "Collaborative build platform", s: "TypeScript" },
    { n: "ember", d: "Static site generator", s: "Go" },
  ];
  return (
    <div className="min-h-screen bg-[#0d0d0d] px-8 py-16 font-mono text-[#f5f5f0]">
      <div className="mx-auto max-w-2xl">
        <p className="text-[#888880]">$ whoami</p>
        <h1 className="mt-2 text-3xl">Alex Chen</h1>
        <p className="mt-1 text-[#888880]">// systems engineer · open source</p>
        <p className="mt-10 text-[#888880]">$ ls projects/</p>
        <div className="mt-3 space-y-2">
          {projects.map((p, i) => (
            <div key={i} className="flex items-center justify-between rounded-[8px] border border-[#2a2a2a] bg-[#141414] px-4 py-3">
              <div>
                <span className="text-[#f59e0b]">{p.n}</span>
                <span className="ml-3 text-sm text-[#888880]">{p.d}</span>
              </div>
              <span className="text-[11px] text-[#ec4899]">{p.s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}`,
  },

  // ── Dashboard (4) ───────────────────────────────────────
  {
    id: "dash-analytics",
    name: "Analytics",
    category: "dashboard",
    tags: ["Sidebar"],
    popularity: 91,
    code: `export default function App() {
  const stats = [
    { l: "Revenue", v: "$48.2k", c: "+12%" },
    { l: "Users", v: "1,284", c: "+8%" },
    { l: "Active", v: "92%", c: "+3%" },
    { l: "Churn", v: "1.4%", c: "-0.2%" },
  ];
  return (
    <div className="flex min-h-screen bg-[#0d0d0d] text-[#f5f5f0]">
      <aside className="w-52 border-r border-[#2a2a2a] bg-[#141414] p-4">
        <span className="text-base" ${serif}>Pulse</span>
        <nav className="mt-6 space-y-1 font-mono text-sm">
          {["Overview","Reports","Audience","Settings"].map((x,i)=>(
            <a key={i} className={"block rounded-[8px] px-3 py-2 " + (i===0 ? "bg-[#1a1a1a] text-[#f59e0b]" : "text-[#888880] hover:text-[#f5f5f0]")}>{x}</a>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">
        <h1 className="text-2xl" ${serif}>Overview</h1>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s,i)=>(
            <div key={i} className="rounded-[12px] border border-[#2a2a2a] bg-[#141414] p-5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[#888880]">{s.l}</p>
              <p className="mt-1 text-2xl font-semibold">{s.v}</p>
              <p className="mt-1 text-[11px] text-[#22c55e]">{s.c}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 h-64 rounded-[12px] border border-[#2a2a2a] bg-gradient-to-b from-[#141414] to-[#0d0d0d]" />
      </main>
    </div>
  );
}`,
  },
  {
    id: "dash-admin",
    name: "Admin Panel",
    category: "dashboard",
    tags: ["Table"],
    popularity: 72,
    code: `export default function App() {
  const rows = [
    { n: "Ada Lovelace", e: "ada@mail.com", r: "Admin", s: "Active" },
    { n: "Alan Turing", e: "alan@mail.com", r: "Editor", s: "Active" },
    { n: "Grace Hopper", e: "grace@mail.com", r: "Viewer", s: "Invited" },
  ];
  return (
    <div className="flex min-h-screen bg-[#0d0d0d] text-[#f5f5f0]">
      <aside className="w-52 border-r border-[#2a2a2a] bg-[#141414] p-4">
        <span className="text-base" ${serif}>Console</span>
        <nav className="mt-6 space-y-1 font-mono text-sm">
          {["Users","Roles","Billing","Logs"].map((x,i)=>(
            <a key={i} className={"block rounded-[8px] px-3 py-2 " + (i===0 ? "bg-[#1a1a1a] text-[#f59e0b]" : "text-[#888880] hover:text-[#f5f5f0]")}>{x}</a>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl" ${serif}>Users</h1>
          <button className="rounded-[8px] bg-[#f59e0b] px-4 py-2 text-sm text-[#0d0d0d]">+ Invite</button>
        </div>
        <div className="mt-5 overflow-hidden rounded-[12px] border border-[#2a2a2a]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#141414] font-mono text-[11px] uppercase tracking-wider text-[#888880]">
              <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th></tr>
            </thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={i} className="border-t border-[#2a2a2a]">
                  <td className="px-4 py-3">{r.n}</td>
                  <td className="px-4 py-3 text-[#888880]">{r.e}</td>
                  <td className="px-4 py-3">{r.r}</td>
                  <td className="px-4 py-3"><span className={"rounded-[9999px] px-2 py-0.5 text-[11px] " + (r.s==="Active" ? "bg-[#22c55e]/15 text-[#22c55e]" : "bg-[#888880]/15 text-[#888880]")}>{r.s}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}`,
  },
  {
    id: "dash-finance",
    name: "Finance",
    category: "dashboard",
    tags: [],
    popularity: 64,
    code: `export default function App() {
  const cards = [
    { l: "Balance", v: "$128,400" },
    { l: "Income", v: "$24,100" },
    { l: "Expenses", v: "$9,820" },
  ];
  return (
    <div className="min-h-screen bg-[#0d0d0d] p-8 text-[#f5f5f0]">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl" ${serif}>Wallet</h1>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {cards.map((c,i)=>(
            <div key={i} className="rounded-[12px] border border-[#2a2a2a] bg-[#141414] p-5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[#888880]">{c.l}</p>
              <p className="mt-1 text-2xl font-semibold">{c.v}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-[12px] border border-[#2a2a2a] bg-[#141414] p-5">
          <p className="font-mono text-[11px] uppercase tracking-wider text-[#888880]">Cash flow</p>
          <div className="mt-4 flex h-40 items-end gap-2">
            {[40,65,50,80,55,90,70].map((h,i)=>(
              <div key={i} className="flex-1 rounded-t-[4px] bg-gradient-to-t from-[#f59e0b]/30 to-[#f59e0b]" style={{ height: h + "%" }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}`,
  },
  {
    id: "dash-tracker",
    name: "Project Tracker",
    category: "dashboard",
    tags: ["Kanban"],
    popularity: 70,
    code: `export default function App() {
  const cols = [
    { t: "To do", items: ["Design system", "Auth flow"] },
    { t: "In progress", items: ["Preview engine", "Version history"] },
    { t: "Done", items: ["Landing page"] },
  ];
  return (
    <div className="min-h-screen bg-[#0d0d0d] p-8 text-[#f5f5f0]">
      <h1 className="text-2xl" ${serif}>Sprint board</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {cols.map((c,i)=>(
          <div key={i} className="rounded-[12px] border border-[#2a2a2a] bg-[#141414] p-4">
            <p className="font-mono text-[11px] uppercase tracking-wider text-[#888880]">{c.t}</p>
            <div className="mt-3 space-y-2">
              {c.items.map((it,j)=>(
                <div key={j} className="rounded-[8px] border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2.5 text-sm">{it}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}`,
  },

  // ── E-commerce (3) ──────────────────────────────────────
  {
    id: "shop-product",
    name: "Product Page",
    category: "ecommerce",
    tags: [],
    popularity: 85,
    code: `export default function App() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] px-8 py-16 text-[#f5f5f0]">
      <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-2">
        <div className="aspect-square rounded-[16px] border border-[#2a2a2a] bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d]" />
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-[#f59e0b]">New arrival</p>
          <h1 className="mt-2 text-4xl" ${serif}>Aero Lounge Chair</h1>
          <p className="mt-3 text-2xl font-semibold">$420</p>
          <p className="mt-4 text-[#888880]">Sculpted for comfort and built to last. A statement piece for the modern space.</p>
          <div className="mt-6 flex gap-2">
            {["Sand","Charcoal","Olive"].map((c,i)=>(
              <button key={i} className="rounded-[8px] border border-[#2a2a2a] px-3 py-1.5 text-sm hover:border-[#f59e0b]">{c}</button>
            ))}
          </div>
          <button className="mt-8 w-full rounded-[8px] bg-[#f59e0b] py-3 text-sm font-medium text-[#0d0d0d]">Add to cart</button>
        </div>
      </div>
    </div>
  );
}`,
  },
  {
    id: "shop-grid",
    name: "Shop Grid",
    category: "ecommerce",
    tags: ["Filters"],
    popularity: 79,
    code: `export default function App() {
  const products = [
    { n: "Aero Chair", p: "$420" },
    { n: "Linen Sofa", p: "$1,290" },
    { n: "Oak Table", p: "$680" },
    { n: "Glow Lamp", p: "$140" },
    { n: "Wool Rug", p: "$320" },
    { n: "Ceramic Vase", p: "$60" },
  ];
  return (
    <div className="min-h-screen bg-[#0d0d0d] px-8 py-12 text-[#f5f5f0]">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl" ${serif}>Shop</h1>
          <div className="flex gap-2 font-mono text-[11px]">
            {["All","Seating","Lighting","Decor"].map((f,i)=>(
              <button key={i} className={"rounded-[9999px] px-3 py-1 " + (i===0 ? "bg-[#f59e0b] text-[#0d0d0d]" : "border border-[#2a2a2a] text-[#888880]")}>{f}</button>
            ))}
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p,i)=>(
            <div key={i} className="group rounded-[12px] border border-[#2a2a2a] bg-[#141414] p-3">
              <div className="aspect-square rounded-[8px] bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d]" />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm">{p.n}</span>
                <span className="text-sm text-[#f59e0b]">{p.p}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}`,
  },
  {
    id: "shop-checkout",
    name: "Checkout",
    category: "ecommerce",
    tags: [],
    popularity: 61,
    code: `export default function App() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] px-8 py-16 text-[#f5f5f0]">
      <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-[1.4fr_1fr]">
        <div>
          <h1 className="text-2xl" ${serif}>Checkout</h1>
          <form className="mt-6 space-y-3">
            <input placeholder="Email" className="w-full rounded-[8px] border border-[#2a2a2a] bg-[#141414] px-3 py-2.5 text-sm outline-none" />
            <input placeholder="Card number" className="w-full rounded-[8px] border border-[#2a2a2a] bg-[#141414] px-3 py-2.5 text-sm outline-none" />
            <div className="flex gap-3">
              <input placeholder="MM / YY" className="w-full rounded-[8px] border border-[#2a2a2a] bg-[#141414] px-3 py-2.5 text-sm outline-none" />
              <input placeholder="CVC" className="w-full rounded-[8px] border border-[#2a2a2a] bg-[#141414] px-3 py-2.5 text-sm outline-none" />
            </div>
            <button className="w-full rounded-[8px] bg-[#f59e0b] py-3 text-sm font-medium text-[#0d0d0d]">Pay $580</button>
          </form>
        </div>
        <div className="rounded-[12px] border border-[#2a2a2a] bg-[#141414] p-5">
          <p className="font-mono text-[11px] uppercase tracking-wider text-[#888880]">Order summary</p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between"><span>Aero Chair</span><span>$420</span></div>
            <div className="flex justify-between"><span>Glow Lamp</span><span>$140</span></div>
            <div className="flex justify-between text-[#888880]"><span>Shipping</span><span>$20</span></div>
            <div className="flex justify-between border-t border-[#2a2a2a] pt-3 font-semibold"><span>Total</span><span className="text-[#f59e0b]">$580</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}`,
  },

  // ── Components (5) ──────────────────────────────────────
  {
    id: "comp-pricing",
    name: "Pricing Table",
    category: "components",
    tags: [],
    popularity: 88,
    code: `export default function App() {
  const tiers = [
    { n: "Starter", p: "$0", f: ["1 project","Community"], hi: false },
    { n: "Pro", p: "$19", f: ["Unlimited","Priority support","Custom domain"], hi: true },
    { n: "Team", p: "$49", f: ["Everything in Pro","5 seats","SSO"], hi: false },
  ];
  return (
    <div className="flex min-h-screen items-center bg-[#0d0d0d] px-8 py-16 text-[#f5f5f0]">
      <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-3">
        {tiers.map((t,i)=>(
          <div key={i} className={"rounded-[12px] p-6 " + (t.hi ? "border-2 border-[#f59e0b] bg-[#1a1a1a]" : "border border-[#2a2a2a] bg-[#141414]")}>
            {t.hi && <span className="font-mono text-[10px] uppercase tracking-widest text-[#f59e0b]">Recommended</span>}
            <h3 className="mt-1 text-lg" ${serif}>{t.n}</h3>
            <p className="mt-2 text-3xl font-semibold">{t.p}<span className="text-sm text-[#888880]">/mo</span></p>
            <ul className="mt-4 space-y-2 text-sm text-[#888880]">{t.f.map((x,j)=>(<li key={j}>— {x}</li>))}</ul>
            <button className={"mt-6 w-full rounded-[8px] py-2 text-sm " + (t.hi ? "bg-[#f59e0b] text-[#0d0d0d]" : "border border-[#2a2a2a]")}>Get started</button>
          </div>
        ))}
      </div>
    </div>
  );
}`,
  },
  {
    id: "comp-bento",
    name: "Feature Bento",
    category: "components",
    tags: ["Asymmetric"],
    popularity: 90,
    code: `export default function App() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] px-8 py-16 text-[#f5f5f0]">
      <div className="mx-auto grid max-w-4xl auto-rows-[140px] grid-cols-3 gap-4">
        <div className="col-span-2 row-span-2 rounded-[16px] border border-[#2a2a2a] bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] p-6">
          <h3 className="text-2xl" ${serif}>Built for speed</h3>
          <p className="mt-2 max-w-xs text-sm text-[#888880]">Everything updates instantly as you work.</p>
        </div>
        <div className="rounded-[16px] border border-[#2a2a2a] bg-[#141414] p-6"><div className="h-8 w-8 rounded-[8px] bg-[#f59e0b]/20" /><p className="mt-3 text-sm">Realtime</p></div>
        <div className="rounded-[16px] border border-[#2a2a2a] bg-[#141414] p-6"><div className="h-8 w-8 rounded-[8px] bg-[#ec4899]/20" /><p className="mt-3 text-sm">Shared</p></div>
        <div className="col-span-2 rounded-[16px] border border-[#2a2a2a] bg-[#141414] p-6"><p className="text-sm text-[#888880]">A premium, asymmetric grid that draws the eye.</p></div>
        <div className="rounded-[16px] border border-[#2a2a2a] bg-gradient-to-br from-[#f59e0b]/20 to-transparent p-6"><p className="text-sm">Premium</p></div>
      </div>
    </div>
  );
}`,
  },
  {
    id: "comp-testimonials",
    name: "Testimonials",
    category: "components",
    tags: ["Carousel"],
    popularity: 66,
    code: `export default function App() {
  const quotes = [
    { q: "Drowa changed how our team ships.", a: "Maya, Founder" },
    { q: "The design quality is unreal by default.", a: "Leo, Designer" },
    { q: "We launched in a weekend.", a: "Sam, Indie hacker" },
  ];
  return (
    <div className="min-h-screen bg-[#0d0d0d] px-8 py-20 text-[#f5f5f0]">
      <h2 className="text-center text-3xl" ${serif}>Loved by <span className="italic text-[#f59e0b]">makers</span></h2>
      <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
        {quotes.map((t,i)=>(
          <div key={i} className="rounded-[12px] border border-[#2a2a2a] bg-[#141414] p-6">
            <p className="text-lg leading-snug" ${serif}>“{t.q}”</p>
            <div className="mt-5 flex items-center gap-3">
              <div className="h-8 w-8 rounded-[9999px] bg-gradient-to-br from-[#f59e0b] to-[#ec4899]" />
              <span className="font-mono text-[11px] text-[#888880]">{t.a}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}`,
  },
  {
    id: "comp-faq",
    name: "FAQ Accordion",
    category: "components",
    tags: [],
    popularity: 58,
    code: `export default function App() {
  const faqs = [
    { q: "Can I cancel anytime?", a: "Yes — no contracts, cancel in one click." },
    { q: "Do you offer refunds?", a: "We offer a 30-day money-back guarantee." },
    { q: "Is there a free plan?", a: "Yes, the Starter plan is free forever." },
  ];
  return (
    <div className="min-h-screen bg-[#0d0d0d] px-8 py-20 text-[#f5f5f0]">
      <div className="mx-auto max-w-xl">
        <h2 className="text-center text-3xl" ${serif}>Questions</h2>
        <div className="mt-8 space-y-2">
          {faqs.map((f,i)=>(
            <details key={i} className="group rounded-[12px] border border-[#2a2a2a] bg-[#141414] p-4">
              <summary className="flex cursor-pointer items-center justify-between text-sm">{f.q}<span className="text-[#f59e0b] group-open:rotate-45 transition-transform">+</span></summary>
              <p className="mt-3 text-sm text-[#888880]">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}`,
  },
  {
    id: "comp-shell",
    name: "Nav + Footer",
    category: "components",
    tags: ["Layout shell"],
    popularity: 55,
    code: `export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-[#0d0d0d] text-[#f5f5f0]">
      <nav className="flex items-center justify-between border-b border-[#2a2a2a] px-8 py-4">
        <span className="text-lg" ${serif}>Drowa</span>
        <div className="flex items-center gap-6 font-mono text-sm text-[#888880]">
          <a className="hover:text-[#f5f5f0]">Product</a>
          <a className="hover:text-[#f5f5f0]">Pricing</a>
          <a className="hover:text-[#f5f5f0]">About</a>
          <button className="rounded-[8px] bg-[#f59e0b] px-4 py-2 text-[#0d0d0d]">Sign up</button>
        </div>
      </nav>
      <main className="flex flex-1 items-center justify-center">
        <p className="font-mono text-sm text-[#888880]">Your content here</p>
      </main>
      <footer className="border-t border-[#2a2a2a] px-8 py-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between font-mono text-xs text-[#888880]">
          <span className="text-base text-[#f5f5f0]" ${serif}>Drowa</span>
          <div className="flex gap-5"><a className="hover:text-[#f5f5f0]">Privacy</a><a className="hover:text-[#f5f5f0]">Terms</a></div>
          <span>© 2026</span>
        </div>
      </footer>
    </div>
  );
}`,
  },

  // ── Portfolio (3) ───────────────────────────────────────
  {
    id: "port-creative",
    name: "Creative",
    category: "portfolio",
    tags: ["Image heavy"],
    popularity: 83,
    code: `export default function App() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] text-[#f5f5f0]">
      <header className="px-10 py-10">
        <h1 className="text-5xl" ${serif}>Juno <span className="italic text-[#ec4899]">Park</span></h1>
        <p className="mt-2 font-mono text-sm text-[#888880]">Art director · photographer</p>
      </header>
      <div className="grid gap-4 px-10 pb-10 md:grid-cols-3">
        {[1,2,3,4,5,6].map((i)=>(
          <div key={i} className={"rounded-[12px] border border-[#2a2a2a] bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] " + (i % 4 === 0 ? "md:col-span-2 aspect-[2/1]" : "aspect-square")} />
        ))}
      </div>
    </div>
  );
}`,
  },
  {
    id: "port-case-study",
    name: "Case Study",
    category: "portfolio",
    tags: ["Multi page"],
    popularity: 60,
    code: `export default function App() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] px-8 py-16 text-[#f5f5f0]">
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-[11px] uppercase tracking-widest text-[#f59e0b]">Case study</p>
        <h1 className="mt-2 text-4xl" ${serif}>Rebranding Northwind</h1>
        <div className="mt-6 aspect-video rounded-[12px] border border-[#2a2a2a] bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d]" />
        <div className="mt-8 grid grid-cols-3 gap-4 font-mono text-sm">
          <div><p className="text-[#888880]">Role</p><p className="mt-1">Lead designer</p></div>
          <div><p className="text-[#888880]">Year</p><p className="mt-1">2026</p></div>
          <div><p className="text-[#888880]">Timeline</p><p className="mt-1">6 weeks</p></div>
        </div>
        <p className="mt-8 leading-relaxed text-[#888880]">We reimagined the brand from the ground up — a new identity system, a refreshed product surface, and a tone of voice that finally matched the ambition of the team.</p>
      </div>
    </div>
  );
}`,
  },
  {
    id: "port-minimal",
    name: "Minimal",
    category: "portfolio",
    tags: ["Whitespace"],
    popularity: 71,
    code: `export default function App() {
  const work = ["Helio — brand", "Vesper — app", "Atlas — site"];
  return (
    <div className="flex min-h-screen flex-col justify-center bg-[#0d0d0d] px-12 text-[#f5f5f0]">
      <h1 className="text-3xl" ${serif}>Mara Devlin</h1>
      <p className="mt-2 max-w-sm text-[#888880]">Independent designer working with founders on brand and product.</p>
      <div className="mt-12 space-y-4">
        {work.map((w,i)=>(
          <a key={i} className="block border-b border-[#2a2a2a] pb-3 text-lg text-[#888880] transition-colors hover:text-[#f59e0b]">{w} ↗</a>
        ))}
      </div>
    </div>
  );
}`,
  },
];
