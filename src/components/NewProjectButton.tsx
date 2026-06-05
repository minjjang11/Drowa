"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "@/app/actions";

interface Repo {
  full_name: string;
  private: boolean;
  updated_at: string;
  default_branch: string;
}

export function NewProjectButton({
  variant,
  label,
  initialTab = "fresh",
}: {
  variant: "card" | "button";
  label?: string;
  initialTab?: "fresh" | "github";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"fresh" | "github">(initialTab);

  const [connected, setConnected] = useState<boolean | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Repo | null>(null);
  const [branch, setBranch] = useState("main");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || tab !== "github" || connected !== null) return;
    (async () => {
      const res = await fetch("/api/github/status");
      const data = await res.json();
      setConnected(data.connected);
      if (data.connected) {
        const r = await fetch("/api/github/repos");
        const rd = await r.json();
        setRepos(rd.repos ?? []);
      }
    })();
  }, [open, tab, connected]);

  async function selectRepo(repo: Repo) {
    setSelected(repo);
    setBranch(repo.default_branch || "main");
  }

  async function doImport() {
    if (!selected) return;
    setImporting(true);
    setError(null);
    const res = await fetch("/api/github/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo: selected.full_name, branch }),
    });
    const data = await res.json();
    setImporting(false);
    if (!res.ok) {
      setError(data.error ?? "Import failed");
      return;
    }
    router.push(`/project/${data.projectId}`);
  }

  const trigger =
    variant === "card" ? (
      <button
        onClick={() => setOpen(true)}
        className="glow-hover flex w-full max-w-md flex-col items-center justify-center gap-2 rounded-[8px] border border-dashed border-[#3a3a30] bg-surface px-6 py-10 transition-colors duration-150 hover:border-accent"
      >
        <span className="text-2xl text-accent">+</span>
        <span className="text-sm font-medium text-foreground">New Project</span>
      </button>
    ) : (
      <button
        onClick={() => setOpen(true)}
        className="btn-grad rounded-[4px] px-3 py-1.5 text-sm font-medium text-foreground"
      >
        {label ?? "+ New Project"}
      </button>
    );

  const filtered = repos.filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      {trigger}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="grad-border w-full max-w-md rounded-[8px] bg-surface p-6 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
          >
            <div className="mb-4 flex gap-1">
              {(["fresh", "github"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-[4px] px-3 py-1.5 font-mono text-[11px] transition-colors ${
                    tab === t ? "bg-surface-elevated text-accent" : "text-muted hover:text-foreground"
                  }`}
                >
                  {t === "fresh" ? "Start fresh" : "Import from GitHub"}
                </button>
              ))}
            </div>

            {tab === "fresh" ? (
              <form action={createProject} className="space-y-4">
                <div>
                  <h2 className="serif text-lg italic text-foreground">New Project</h2>
                  <p className="font-mono text-[11px] text-muted">Give it a name to get started.</p>
                </div>
                <input
                  name="name"
                  autoFocus
                  required
                  placeholder="project name"
                  className="input-dark w-full rounded-[4px] px-3 py-2 text-sm"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setOpen(false)} className="rounded-[4px] border border-border bg-surface px-3 py-1.5 font-mono text-[12px] text-muted hover:text-foreground">
                    Cancel
                  </button>
                  <button type="submit" className="btn-grad rounded-[4px] px-3 py-1.5 text-sm font-medium text-foreground">
                    Create
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <h2 className="serif text-lg italic text-foreground">Import from GitHub</h2>
                {connected === null ? (
                  <p className="font-mono text-[11px] text-muted">Checking connection…</p>
                ) : !connected ? (
                  <a
                    href="/api/github/connect"
                    className="btn-grad block rounded-[4px] px-3 py-2 text-center text-sm font-medium text-foreground"
                  >
                    Connect GitHub
                  </a>
                ) : !selected ? (
                  <>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="search repos…"
                      className="input-dark w-full rounded-[4px] px-3 py-2 text-sm"
                    />
                    <div className="max-h-64 space-y-1 overflow-y-auto">
                      {filtered.map((r) => (
                        <button
                          key={r.full_name}
                          onClick={() => selectRepo(r)}
                          className="glow-hover flex w-full items-center justify-between gap-2 rounded-[4px] border border-border bg-background px-3 py-2 text-left hover:border-accent"
                        >
                          <span className="truncate font-mono text-[12px] text-foreground">{r.full_name}</span>
                          <span className="shrink-0 font-mono text-[10px] text-muted">
                            {r.private ? "private" : "public"} · {new Date(r.updated_at).toLocaleDateString()}
                          </span>
                        </button>
                      ))}
                      {filtered.length === 0 && (
                        <p className="py-4 text-center font-mono text-[11px] text-muted">No repos found.</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <p className="font-mono text-[12px] text-foreground">{selected.full_name}</p>
                    <label className="block font-mono text-[11px] text-muted">
                      Branch
                      <input
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        className="input-dark mt-1 w-full rounded-[4px] px-3 py-2 text-sm"
                      />
                    </label>
                    {error && <p className="font-mono text-[11px] text-error">{error}</p>}
                    <div className="flex justify-between gap-2">
                      <button onClick={() => setSelected(null)} className="rounded-[4px] border border-border bg-surface px-3 py-1.5 font-mono text-[12px] text-muted hover:text-foreground">
                        Back
                      </button>
                      <button
                        onClick={doImport}
                        disabled={importing}
                        className="btn-grad rounded-[4px] px-3 py-1.5 text-sm font-medium text-foreground disabled:opacity-50"
                      >
                        {importing ? "Importing…" : "Import"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
