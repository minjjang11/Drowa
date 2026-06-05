"use client";

import { useState, useRef, useEffect } from "react";
import type { AiRole } from "@/lib/types";
import { QuickActionsBar } from "./QuickActionsBar";
import { useI18n } from "@/lib/i18n";
import type { QuickAction } from "@/lib/quickActions";

// Only render the most recent messages — keeps the DOM light in long sessions.
const RENDER_LIMIT = 50;

export interface ChatMessage {
  sender: "user" | "ai";
  content: string;
}

export function ChatPanel({
  role,
  title,
  messages,
  busy,
  onSend,
  suggestions,
  onSuggestion,
  prefill,
  quickActions,
  onQuickAction,
  onAddQuickAction,
  errorCard,
  onFix,
}: {
  role: AiRole;
  title: string;
  messages: ChatMessage[];
  busy: boolean;
  onSend: (prompt: string) => void;
  suggestions?: string[];
  onSuggestion?: (s: string) => void;
  /** Programmatic input fill (Apply Style). Bump `n` to re-apply the same text. */
  prefill?: { text: string; n: number };
  quickActions?: QuickAction[];
  onQuickAction?: (promptTemplate: string) => void;
  onAddQuickAction?: () => void;
  errorCard?: { message: string } | null;
  onFix?: () => void;
}) {
  const { t } = useI18n();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const visible = messages.length > RENDER_LIMIT ? messages.slice(-RENDER_LIMIT) : messages;

  useEffect(() => {
    if (prefill && prefill.text) {
      setInput(prefill.text);
      textareaRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.n]);

  const tag = role === "dev_ai" ? "DEV" : "DESIGN";
  const tagColor = role === "dev_ai" ? "text-accent" : "text-accent-2";
  // [DEV] dark pill / [DESIGN] cream pill.
  const tagPill =
    role === "dev_ai" ? "bg-accent text-white" : "bg-highlight text-foreground";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = input.trim();
    if (!v || busy) return;
    onSend(v);
    setInput("");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
        <span className={`rounded-[4px] px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-wider ${tagPill}`}>
          {tag}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
          {title}
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && (
          <p className="font-mono text-[11px] leading-relaxed text-muted">
            {role === "dev_ai" ? t("askDev") : t("askDesign")}
          </p>
        )}
        {visible.map((m, i) => (
          <div key={i} className="space-y-1">
            <span className={`font-mono text-[9px] font-semibold tracking-wider ${m.sender === "user" ? "text-muted" : tagColor}`}>
              {m.sender === "user" ? "YOU" : tag}
            </span>
            <div
              className={`rounded-[8px] px-2.5 py-2 text-[13px] leading-relaxed ${
                m.sender === "user"
                  ? "bg-accent text-white"
                  : "bg-background text-foreground"
              }`}
            >
              <pre className="whitespace-pre-wrap break-words font-sans">{m.content}</pre>
            </div>
          </div>
        ))}
        {busy && (
          <div className="space-y-1">
            <span className={`font-mono text-[9px] font-semibold tracking-wider ${tagColor}`}>
              {tag}
            </span>
            <div className="space-y-1.5 rounded-[4px] border-l-2 border-accent bg-surface-elevated px-2.5 py-2.5">
              <div className="h-2 w-3/4 animate-pulse rounded bg-border" />
              <div className="h-2 w-full animate-pulse rounded bg-border" />
              <div className="h-2 w-1/2 animate-pulse rounded bg-border" />
            </div>
          </div>
        )}
      </div>

      {errorCard && (
        <div className="shrink-0 border-t border-border bg-surface px-2 pt-2">
          <div className="rounded-[4px] border-l-2 border-error bg-surface-elevated px-2.5 py-2">
            <p className="font-mono text-[10px] font-semibold tracking-wider text-error">
              [{tag}] Error detected
            </p>
            <p className="mt-1 line-clamp-2 font-mono text-[11px] leading-snug text-foreground">
              {errorCard.message}
            </p>
            <button
              onClick={onFix}
              disabled={busy}
              className="mt-2 rounded-[4px] bg-accent px-2.5 py-1 font-mono text-[10px] font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Fix automatically ↗
            </button>
          </div>
        </div>
      )}

      {quickActions && quickActions.length > 0 && onQuickAction && onAddQuickAction && (
        <QuickActionsBar
          actions={quickActions}
          busy={busy}
          onFire={onQuickAction}
          onAdd={onAddQuickAction}
        />
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="shrink-0 border-t border-border px-2 pt-2">
          <p className="mb-1.5 font-mono text-[10px] text-muted">Refine this template…</p>
          <div className="flex flex-wrap gap-1">
            {suggestions.map((s) => (
              <button
                key={s}
                disabled={busy}
                onClick={() => onSuggestion?.(s)}
                className="glow-hover rounded-[4px] border border-border bg-background px-2 py-1 font-mono text-[10px] text-foreground transition-colors hover:border-accent disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={submit} className="shrink-0 border-t border-border p-2">
        <textarea
          ref={textareaRef}
          rows={2}
          value={input}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) submit(e);
          }}
          placeholder={t("chatPlaceholder")}
          className="input-dark w-full resize-none rounded-[4px] px-2.5 py-2 font-mono text-[12px] disabled:opacity-50"
        />
      </form>
    </div>
  );
}
