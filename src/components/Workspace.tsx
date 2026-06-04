"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Preview } from "./Preview";
import { ChatPanel, type ChatMessage } from "./ChatPanel";
import type { AiRole } from "@/lib/types";

export function Workspace({
  projectId,
  projectName,
  initialCode,
  initialDev,
  initialDesign,
}: {
  projectId: string;
  projectName: string;
  initialCode: string;
  initialDev: ChatMessage[];
  initialDesign: ChatMessage[];
}) {
  const [code, setCode] = useState(initialCode);
  const [dev, setDev] = useState<ChatMessage[]>(initialDev);
  const [design, setDesign] = useState<ChatMessage[]>(initialDesign);
  const [busy, setBusy] = useState<AiRole | null>(null);

  // Live preview sync: when the partner's AI writes a new file, reflect it here.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`files:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "files",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const row = payload.new as { path: string; content: string };
          if (row?.path === "App.tsx") setCode(row.content);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  async function send(role: AiRole, prompt: string) {
    const append = role === "dev_ai" ? setDev : setDesign;
    append((prev) => [...prev, { sender: "user", content: prompt }]);
    setBusy(role);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, role, prompt }),
      });
      const data = await res.json();

      if (!res.ok) {
        append((prev) => [
          ...prev,
          { sender: "ai", content: `⚠️ ${data.error ?? "Request failed"}` },
        ]);
        return;
      }

      append((prev) => [...prev, { sender: "ai", content: data.reply }]);
      if (data.code) setCode(data.code);
    } catch {
      append((prev) => [
        ...prev,
        { sender: "ai", content: "⚠️ Network error" },
      ]);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-white/50 hover:text-white">
            ← Drowa
          </Link>
          <span className="font-medium">{projectName}</span>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-[320px_1fr_320px] overflow-hidden">
        <aside className="border-r border-white/10">
          <ChatPanel
            role="dev_ai"
            title="Developer AI"
            accent="#7dd3fc"
            messages={dev}
            busy={busy === "dev_ai"}
            onSend={(p) => send("dev_ai", p)}
          />
        </aside>

        <main className="overflow-hidden bg-white/5">
          <Preview code={code} />
        </main>

        <aside className="border-l border-white/10">
          <ChatPanel
            role="design_ai"
            title="Designer AI"
            accent="#f0abfc"
            messages={design}
            busy={busy === "design_ai"}
            onSend={(p) => send("design_ai", p)}
          />
        </aside>
      </div>
    </div>
  );
}
