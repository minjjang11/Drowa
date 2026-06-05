"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useI18n, type TKey } from "@/lib/i18n";
import { Tooltip } from "./Tooltip";
import type { DeviceMode, Status } from "@/lib/types";

const DEVICES: { id: DeviceMode; label: string; icon: string }[] = [
  { id: "desktop", label: "Desktop", icon: "▢" },
  { id: "tablet", label: "Tablet", icon: "▯" },
  { id: "mobile", label: "Mobile", icon: "▮" },
];

// Only three states surface to the user: Ready / Building… / Error.
const STATUS_META: Record<Status, { dot: string; key: TKey; spin?: boolean }> = {
  ready: { dot: "bg-success", key: "ready" },
  generating: { dot: "bg-accent", key: "building", spin: true },
  saved: { dot: "bg-success", key: "ready" },
  error: { dot: "bg-error", key: "error" },
};

// KO / EN pill switcher.
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

function InvitePopover({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"developer" | "designer">("designer");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

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
      <Tooltip label={t("inviteTip")}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="glow-hover flex h-7 items-center gap-1 rounded-[4px] border border-border bg-background px-2 text-sm text-foreground transition-colors hover:border-accent hover:text-accent"
        >
          👤 <span className="font-mono text-[11px]">{t("invite")}</span>
        </button>
      </Tooltip>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="grad-border absolute right-0 top-9 z-50 w-60 rounded-[8px] bg-surface p-4 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
            <p className="serif text-sm italic text-foreground">Invite a teammate</p>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted">Role</p>
            <div className="mt-1.5 flex gap-1 rounded-[6px] border border-border bg-background p-0.5">
              {(["developer", "designer"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`flex-1 rounded-[4px] px-2 py-1 font-mono text-[11px] capitalize transition-colors ${
                    role === r ? "bg-accent text-[#0d0d0d]" : "text-muted hover:text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <button
              onClick={copyLink}
              disabled={busy}
              className="mt-3 w-full rounded-[6px] bg-accent px-3 py-2 font-mono text-[11px] font-medium text-[#0d0d0d] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {copied ? "✓ Copied!" : busy ? "…" : "Copy invite link"}
            </button>
            <p className="mt-2 text-center font-mono text-[10px] text-muted">Link expires in 7 days</p>
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
  /** Progressive disclosure: hide build/ship extras until there's something to work on. */
  hasContent: boolean;
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
    <header className="grad-border-bottom flex h-11 shrink-0 items-center justify-between bg-surface px-3">
      {/* Left: logo + editable name */}
      <div className="flex items-center gap-2">
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
        <span
          className="flex items-center gap-1.5 font-mono text-[10px] text-muted"
          title="GitHub status"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              !github.linked ? "bg-muted" : github.dirty ? "bg-accent" : "bg-success"
            }`}
          />
          {!github.linked ? "Not connected" : github.dirty ? "Changes" : "Synced"}
        </span>
        {github.linked && hasContent && (
          <div className="flex items-center gap-1">
            <Tooltip label={t("pullTip")}>
              <button
                onClick={onPull}
                disabled={github.busy}
                className="glow-hover rounded-[3px] border border-border bg-surface px-2 py-0.5 font-mono text-[10px] text-muted transition-colors hover:border-accent hover:text-foreground disabled:opacity-50"
              >
                {t("pull")}
              </button>
            </Tooltip>
            <Tooltip label={t("syncTip")}>
              <button
                onClick={onSync}
                disabled={github.busy}
                className="glow-hover rounded-[3px] border border-border bg-surface px-2 py-0.5 font-mono text-[10px] text-muted transition-colors hover:border-accent hover:text-foreground disabled:opacity-50"
              >
                {github.busy ? "…" : `${t("sync")} ↗`}
              </button>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Center: device pill switcher */}
      <div className="flex items-center gap-0.5 rounded-[5px] border border-border bg-background p-0.5">
        {DEVICES.map((d) => (
          <button
            key={d.id}
            onClick={() => onDevice(d.id)}
            title={d.label}
            className={`flex items-center gap-1.5 rounded-[3px] px-2.5 py-1 font-mono text-[11px] transition-colors duration-150 ${
              device === d.id
                ? "bg-surface-elevated text-accent shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
                : "text-muted hover:text-foreground"
            }`}
          >
            <span>{d.icon}</span>
            {d.label}
          </button>
        ))}
      </div>

      {/* Right: build/ship tools (revealed once there's content) + lang + status */}
      <div className="flex items-center gap-2">
        {hasContent && (
          <>
            <Tooltip label={t("saveVersionTip")}>
              <button onClick={onSaveVersion} className="glow-hover flex h-7 w-7 items-center justify-center rounded-[4px] border border-border bg-background text-sm text-foreground transition-colors hover:border-accent">⊕</button>
            </Tooltip>
            <Tooltip label={t("versionsTip")}>
              <button onClick={onOpenVersions} className="glow-hover flex h-7 w-7 items-center justify-center rounded-[4px] border border-border bg-background text-sm text-foreground transition-colors hover:border-accent">⟲</button>
            </Tooltip>
            <Tooltip label={t("inspirationTip")}>
              <button onClick={onOpenInspiration} className="glow-hover flex h-7 w-7 items-center justify-center rounded-[4px] border border-border bg-background text-sm text-accent-2 transition-colors hover:border-accent">✦</button>
            </Tooltip>
            <Tooltip label={t("templatesTip")}>
              <button onClick={onOpenTemplates} className="glow-hover flex h-7 w-7 items-center justify-center rounded-[4px] border border-border bg-background text-sm text-foreground transition-colors hover:border-accent">▦</button>
            </Tooltip>
            <Tooltip label={t("designTip")}>
              <button onClick={onOpenDesign} className="glow-hover flex h-7 w-7 items-center justify-center rounded-[4px] border border-border bg-background text-sm text-accent transition-colors hover:border-accent">◈</button>
            </Tooltip>
          </>
        )}
        <div className="flex items-center gap-1.5 rounded-[4px] border border-border bg-background px-2 py-1 font-mono text-[11px] text-muted">
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${meta.spin ? "amber-pulse" : ""}`} />
          {t(meta.key)}
        </div>
        <LangToggle />
        {hasContent && (
          <>
            <InvitePopover projectId={projectId} />
            <Tooltip label={t("exportTip")}>
              <button onClick={onExport} className="btn-grad rounded-[4px] px-2.5 py-1 font-mono text-[11px] text-muted hover:text-foreground">{t("export")}</button>
            </Tooltip>
            <Tooltip label={t("deployTip")}>
              <button onClick={onDeploy} className="btn-grad rounded-[4px] px-2.5 py-1 font-mono text-[11px] font-medium text-foreground">{t("deploy")}</button>
            </Tooltip>
          </>
        )}
      </div>
    </header>
  );
}
