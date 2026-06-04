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
      <div className="flex h-9 items-center border-b border-border px-3 font-mono text-[11px] font-medium uppercase tracking-wider text-muted">
        {title}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto p-3">
        {messages.length === 0 && (
          <p className="font-mono text-[11px] leading-relaxed text-muted">
            {role === "dev_ai"
              ? "Ask about logic, structure, behavior."
              : "Ask about color, layout, typography."}
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-[4px] px-2.5 py-2 text-[13px] leading-relaxed ${
              m.sender === "user"
                ? "ml-5 bg-background text-foreground"
                : "mr-5 border border-border bg-surface text-foreground"
            }`}
          >
            <pre className="whitespace-pre-wrap break-words font-sans">{m.content}</pre>
          </div>
        ))}
        {busy && (
          <p className="font-mono text-[11px] text-accent">thinking…</p>
        )}
      </div>

      <form onSubmit={submit} className="border-t border-border p-2">
        <textarea
          rows={2}
          value={input}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) submit(e);
          }}
          placeholder="Describe a change…"
          className="w-full resize-none rounded-[4px] border border-border bg-surface px-2.5 py-2 text-[13px] outline-none transition-colors duration-150 placeholder:text-muted focus:border-accent disabled:opacity-50"
        />
      </form>
    </div>
  );
}
