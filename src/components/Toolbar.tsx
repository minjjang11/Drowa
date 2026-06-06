"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useI18n, type TKey } from "@/lib/i18n";
import type { DeviceMode, Status } from "@/lib/types";
import { HOME_PATH, type PageMeta } from "@/lib/pages";

const DEVICES: { id: DeviceMode; label: string }[] = [
  { id: "desktop", label: "Desktop" },
  { id: "tablet", label: "Tablet" },
  { id: "mobile", label: "Mobile" },
];

const STATUS_META: Record<Status, { dot: string; key: TKey; pill: string; spin?: boolean }> = {
  ready: { dot: "bg-[#16a34a]", key: "ready", pill: "bg-[#e8f5e9] text-[#16a34a]" },
  generating: { dot: "bg-[#b45309]", key: "building", pill: "bg-[#fef3e2] text-[#b45309]", spin: true },
  saved: { dot: "bg-[#9a9a9a]", key: "ready", pill: "bg-[#f5f5f5] text-[#6b6b6b]" },
  error: { dot: "bg-[#dc2626]", key: "error", pill: "bg-[#fef2f2] text-[#dc2626]" },
};

function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex items-center gap-0.5 rounded-[5px] border border-border bg-background p-0.5">
      {(["ko", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`rounded-[3px] px-1.5 py-0.5 font-mono text-[10px] uppercase transition-colors ${
            lang === l ? "bg-surface-elevated text-accent" : "text-muted hover:text-foreground"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function InviteButton({ projectId }: { projectId: string }) {
  const [role, setRole] = useState<"developer" | "designer">("designer");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function copyLink() {
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("invites")
      .insert({ project_id: projectId, role, created_by: user?.id })
      .select("token")
      .single();
    setBusy(false);
    if (error || !data) return;
    const link = `${window.location.origin}/invite/${data.token}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="glow-hover rounded-[4px] border border-border bg-background px-2.5 py-1 font-mono text-[11px] text-foreground transition-colors hover:border-accent"
      >
        Invite
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="liquid-glass-strong absolute right-0 top-9 z-50 w-56 rounded-[8px] p-3 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
            <p className="serif text-[15px] italic text-foreground">Invite teammate</p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted">Role</p>
            <div className="mt-1 flex gap-1 rounded-[5px] border border-border bg-background p-0.5">
              {(["developer", "designer"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`flex-1 rounded-[4px] px-2 py-1 font-mono text-[10px] capitalize transition-colors ${
                    role === r ? "bg-accent text-white" : "text-muted hover:text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <button
              onClick={copyLink}
              disabled={busy}
              className="mt-3 w-full rounded-[5px] bg-accent px-2 py-1.5 font-mono text-[10px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {copied ? "Copied" : busy ? "..." : "Copy invite link"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ToolsMenu({
  github,
  onSync,
  onPull,
  onSaveVersion,
  onOpenVersions,
  onOpenInspiration,
  onOpenTemplates,
  onOpenDesign,
  onExport,
  onDeploy,
  onOpenPreviewEnv,
  showPreviewEnv,
}: {
  github: { linked: boolean; dirty: boolean; busy: boolean };
  onSync: () => void;
  onPull: () => void;
  onSaveVersion: () => void;
  onOpenVersions: () => void;
  onOpenInspiration: () => void;
  onOpenTemplates: () => void;
  onOpenDesign: () => void;
  onExport: () => void;
  onDeploy: () => void;
  onOpenPreviewEnv: () => void;
  showPreviewEnv: boolean;
}) {
  const [open, setOpen] = useState(false);
  const item =
    "block w-full rounded-[4px] px-3 py-1.5 text-left font-mono text-[11px] text-foreground transition-colors hover:bg-highlight disabled:text-muted";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="glow-hover rounded-[4px] border border-border bg-background px-2.5 py-1 font-mono text-[11px] text-foreground transition-colors hover:border-accent"
      >
        Tools
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="liquid-glass-strong absolute right-0 top-9 z-50 w-60 rounded-[8px] p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
            {github.linked && (
              <>
                <button disabled={github.busy} onClick={onPull} className={item}>
                  Pull from GitHub
                </button>
                <button disabled={github.busy} onClick={onSync} className={item}>
                  Sync to GitHub
                </button>
                <div className="my-1 border-t border-border" />
              </>
            )}
            <button onClick={onOpenDesign} className={item}>
              Design system
            </button>
            <button onClick={onOpenTemplates} className={item}>
              Templates
            </button>
            <button onClick={onOpenInspiration} className={item}>
              Inspiration
            </button>
            <div className="my-1 border-t border-border" />
            <button onClick={onSaveVersion} className={item}>
              Save version
            </button>
            <button onClick={onOpenVersions} className={item}>
              Version history
            </button>
            <div className="my-1 border-t border-border" />
            <button onClick={onExport} className={item}>
              Export code
            </button>
            <button onClick={onDeploy} className={item}>
              Download site
            </button>
            {showPreviewEnv && (
              <>
                <div className="my-1 border-t border-border" />
                <button onClick={onOpenPreviewEnv} className={item}>
                  Preview env keys
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PageSwitcher({
  pages,
  activePath,
  onSwitchPage,
  onCreatePage,
  onDeletePage,
}: {
  pages: PageMeta[];
  activePath: string;
  onSwitchPage: (path: string) => void;
  onCreatePage: (slug: string) => void;
  onDeletePage: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = pages.find((p) => p.path === activePath) ?? pages[0];
  const item =
    "flex w-full items-center justify-between gap-2 rounded-[4px] px-2.5 py-1.5 text-left font-mono text-[11px] transition-colors hover:bg-highlight";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="glow-hover flex items-center gap-1.5 rounded-[5px] border border-border bg-background px-2.5 py-1 font-mono text-[11px] text-foreground transition-colors hover:border-accent"
        title="Pages"
      >
        <span className="text-muted">⌹</span>
        {active?.label ?? "Home"}
        <span className="text-muted">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="liquid-glass-strong absolute left-0 top-9 z-50 w-52 rounded-[8px] p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
            {pages.map((p) => (
              <div key={p.path} className="group flex items-center">
                <button
                  onClick={() => {
                    onSwitchPage(p.path);
                    setOpen(false);
                  }}
                  className={`${item} ${p.path === activePath ? "text-accent" : "text-foreground"}`}
                >
                  <span className="truncate">
                    {p.label}
                    <span className="ml-1.5 text-muted">{p.route}</span>
                  </span>
                  {p.path !== HOME_PATH && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete page ${p.label}?`)) onDeletePage(p.path);
                      }}
                      className="hidden text-muted hover:text-error group-hover:inline"
                    >
                      ✕
                    </span>
                  )}
                </button>
              </div>
            ))}
            <div className="my-1 border-t border-border" />
            <button
              onClick={() => {
                const slug = prompt("New page slug (e.g. about, pricing):");
                if (slug && slug.trim()) onCreatePage(slug.trim());
                setOpen(false);
              }}
              className="block w-full rounded-[4px] px-2.5 py-1.5 text-left font-mono text-[11px] text-accent transition-colors hover:bg-highlight"
            >
              + New page
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function Toolbar({
  projectId,
  projectName,
  status,
  device,
  onDevice,
  onExport,
  onDeploy,
  onOpenDesign,
  onOpenTemplates,
  onOpenInspiration,
  onOpenVersions,
  onSaveVersion,
  github,
  onSync,
  onPull,
  hasContent,
  onOpenPreviewEnv,
  showPreviewEnv,
  pages,
  activePath,
  onSwitchPage,
  onCreatePage,
  onDeletePage,
  showPages,
}: {
  projectId: string;
  projectName: string;
  status: Status;
  device: DeviceMode;
  onDevice: (d: DeviceMode) => void;
  onExport: () => void;
  onDeploy: () => void;
  onOpenDesign: () => void;
  onOpenTemplates: () => void;
  onOpenInspiration: () => void;
  onOpenVersions: () => void;
  onSaveVersion: () => void;
  github: { linked: boolean; dirty: boolean; busy: boolean };
  onSync: () => void;
  onPull: () => void;
  hasContent: boolean;
  onOpenPreviewEnv: () => void;
  showPreviewEnv: boolean;
  pages: PageMeta[];
  activePath: string;
  onSwitchPage: (path: string) => void;
  onCreatePage: (slug: string) => void;
  onDeletePage: (path: string) => void;
  showPages: boolean;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(projectName);
  const meta = STATUS_META[status];

  async function commitName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === projectName) {
      setName(projectName);
      return;
    }
    const supabase = createClient();
    await supabase.from("projects").update({ name: trimmed }).eq("id", projectId);
  }

  return (
    <header className="liquid-glass sticky top-0 z-30 flex h-11 shrink-0 items-center justify-between border-b border-[rgba(0,0,0,0.06)] px-3">
      <div className="flex min-w-0 items-center gap-2">
        <Link href="/" className="font-mono text-xs font-semibold text-foreground transition-colors hover:text-accent">
          drowa
        </Link>
        <span className="text-border">/</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="serif w-44 rounded-[3px] border border-transparent bg-transparent px-1.5 py-0.5 text-base italic text-foreground outline-none transition-colors hover:border-border focus:border-accent"
        />
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted" title="GitHub status">
          <span className={`h-1.5 w-1.5 rounded-full ${!github.linked ? "bg-muted" : github.dirty ? "bg-accent" : "bg-success"}`} />
          {!github.linked ? "Not connected" : github.dirty ? "Changes" : "Synced"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {showPages && (
          <PageSwitcher
            pages={pages}
            activePath={activePath}
            onSwitchPage={onSwitchPage}
            onCreatePage={onCreatePage}
            onDeletePage={onDeletePage}
          />
        )}
        <div className="flex items-center gap-0.5 rounded-[5px] border border-border bg-background p-0.5">
        {DEVICES.map((d) => (
          <button
            key={d.id}
            onClick={() => onDevice(d.id)}
            title={d.label}
            className={`rounded-[3px] px-2.5 py-1 font-mono text-[11px] transition-colors duration-150 ${
              device === d.id
                ? "bg-surface-elevated text-accent shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                : "text-muted hover:text-foreground"
            }`}
          >
            {d.label}
          </button>
        ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1.5 rounded-[9999px] px-2.5 py-1 font-mono text-[11px] ${meta.pill}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${meta.spin ? "amber-pulse" : ""}`} />
          {t(meta.key)}
        </div>
        <LangToggle />
        {hasContent && (
          <>
            <InviteButton projectId={projectId} />
            <ToolsMenu
              github={github}
              onSync={onSync}
              onPull={onPull}
              onSaveVersion={onSaveVersion}
              onOpenVersions={onOpenVersions}
              onOpenInspiration={onOpenInspiration}
              onOpenTemplates={onOpenTemplates}
              onOpenDesign={onOpenDesign}
              onExport={onExport}
              onDeploy={onDeploy}
              onOpenPreviewEnv={onOpenPreviewEnv}
              showPreviewEnv={showPreviewEnv}
            />
          </>
        )}
      </div>
    </header>
  );
}
