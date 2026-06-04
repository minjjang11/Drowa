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
  accent,
  messages,
  busy,
  onSend,
}: {
  role: AiRole;
  title: string;
  accent: string;
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
      <div
        className="border-b border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide"
        style={{ color: accent }}
      >
        {title}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && (
          <p className="text-xs text-white/30">
            {role === "dev_ai"
              ? "Ask about logic, structure, behavior."
              : "Ask about color, layout, typography."}
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-lg px-3 py-2 text-sm ${
              m.sender === "user"
                ? "ml-6 bg-white/10"
                : "mr-6 bg-black/30 border border-white/10"
            }`}
          >
            <pre className="whitespace-pre-wrap break-words font-sans">
              {m.content}
            </pre>
          </div>
        ))}
        {busy && <p className="text-xs text-white/40">thinking…</p>}
      </div>

      <form onSubmit={submit} className="border-t border-white/10 p-2">
        <textarea
          rows={2}
          value={input}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) submit(e);
          }}
          placeholder="Describe a change…"
          className="w-full resize-none rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm outline-none focus:border-white/30"
        />
      </form>
    </div>
  );
}
