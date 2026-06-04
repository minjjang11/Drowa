"use client";

import { useState, useRef, useEffect } from "react";
import type { AiRole } from "@/lib/types";

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
}: {
  role: AiRole;
  title: string;
  messages: ChatMessage[];
  busy: boolean;
  onSend: (prompt: string) => void;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const tag = role === "dev_ai" ? "DEV" : "DESIGN";

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
        <span className="font-mono text-[10px] font-semibold tracking-wider text-accent">
          [{tag}]
        </span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
          {title}
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && (
          <p className="font-mono text-[11px] leading-relaxed text-muted">
            {role === "dev_ai"
              ? "Ask about logic, structure, behavior."
              : "Ask about color, layout, typography."}
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className="space-y-1">
            <span className="font-mono text-[9px] font-semibold tracking-wider text-muted">
              {m.sender === "user" ? "YOU" : tag}
            </span>
            <div
              className={`rounded-[4px] px-2.5 py-2 text-[13px] leading-relaxed ${
                m.sender === "user"
                  ? "bg-background text-foreground"
                  : "border border-border bg-surface text-foreground"
              }`}
            >
              <pre className="whitespace-pre-wrap break-words font-sans">{m.content}</pre>
            </div>
          </div>
        ))}
        {busy && (
          <div className="space-y-1">
            <span className="font-mono text-[9px] font-semibold tracking-wider text-accent">
              {tag}
            </span>
            <div className="space-y-1.5 rounded-[4px] border border-border bg-surface px-2.5 py-2.5">
              <div className="h-2 w-3/4 animate-pulse rounded bg-border" />
              <div className="h-2 w-full animate-pulse rounded bg-border" />
              <div className="h-2 w-1/2 animate-pulse rounded bg-border" />
            </div>
          </div>
        )}
      </div>

      <form onSubmit={submit} className="shrink-0 border-t border-border p-2">
        <textarea
          rows={2}
          value={input}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) submit(e);
          }}
          placeholder="describe a change…"
          className="w-full resize-none rounded-[4px] border border-border bg-surface px-2.5 py-2 font-mono text-[12px] outline-none transition-colors duration-150 placeholder:text-muted focus:border-accent disabled:opacity-50"
        />
      </form>
    </div>
  );
}
