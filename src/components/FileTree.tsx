"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface TreeNode {
  name: string;
  path: string;
  children: Map<string, TreeNode>;
  isFile: boolean;
}

function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: "", path: "", children: new Map(), isFile: false };
  for (const p of paths) {
    const parts = p.split("/");
    let node = root;
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      if (!node.children.has(part)) {
        node.children.set(part, {
          name: part,
          path: parts.slice(0, i + 1).join("/"),
          children: new Map(),
          isFile,
        });
      }
      node = node.children.get(part)!;
    });
  }
  return root;
}

function Node({
  node,
  depth,
  active,
  onOpen,
  onContext,
}: {
  node: TreeNode;
  depth: number;
  active: string | null;
  onOpen: (path: string) => void;
  onContext: (e: React.MouseEvent, path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const kids = [...node.children.values()].sort((a, b) =>
    a.isFile === b.isFile ? a.name.localeCompare(b.name) : a.isFile ? 1 : -1,
  );

  return (
    <>
      {node.path !== "" &&
        (node.isFile ? (
          <button
            onClick={() => onOpen(node.path)}
            onContextMenu={(e) => onContext(e, node.path)}
            style={{ paddingLeft: depth * 10 + 8 }}
            className={`flex w-full items-center gap-1.5 rounded-[3px] py-1 pr-2 text-left font-mono text-[12px] ${
              active === node.path ? "bg-surface-elevated text-accent" : "text-foreground hover:bg-background"
            }`}
          >
            <span className="text-muted">·</span>
            <span className="truncate">{node.name}</span>
          </button>
        ) : (
          <button
            onClick={() => setOpen((v) => !v)}
            style={{ paddingLeft: depth * 10 + 8 }}
            className="flex w-full items-center gap-1.5 rounded-[3px] py-1 pr-2 text-left font-mono text-[12px] text-muted hover:text-foreground"
          >
            <span>{open ? "▾" : "▸"}</span>
            <span className="truncate">{node.name}</span>
          </button>
        ))}
      {(node.path === "" || open) &&
        kids.map((c) => (
          <Node key={c.path} node={c} depth={depth + 1} active={active} onOpen={onOpen} onContext={onContext} />
        ))}
    </>
  );
}

export function FileTree({
  projectId,
  onOpen,
  onSaveTemplate,
}: {
  projectId: string;
  onOpen: (path: string, content: string) => void;
  onSaveTemplate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [paths, setPaths] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; path: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    supabase
      .from("files")
      .select("path")
      .eq("project_id", projectId)
      .then(({ data }) => {
        if (data) setPaths(data.map((r) => r.path as string).filter((p) => p !== "overrides.json"));
      });
  }, [open, projectId]);

  async function openFile(path: string) {
    setActive(path);
    const supabase = createClient();
    const { data } = await supabase
      .from("files")
      .select("content")
      .eq("project_id", projectId)
      .eq("path", path)
      .maybeSingle();
    if (data) onOpen(path, data.content as string);
  }

  if (!open) {
    return (
      <div className="flex w-10 shrink-0 flex-col items-center border-r border-border bg-surface py-2">
        <button
          onClick={() => setOpen(true)}
          title="Files"
          className="flex h-7 w-7 items-center justify-center rounded-[4px] font-mono text-sm text-muted transition-colors hover:bg-background hover:text-foreground"
        >
          ▤
        </button>
      </div>
    );
  }

  const tree = buildTree(paths.length ? paths : ["App.tsx"]);

  return (
    <div className="flex w-52 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex h-9 items-center justify-between border-b border-border px-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">Files</span>
        <button
          onClick={() => setOpen(false)}
          title="Collapse"
          className="flex h-5 w-5 items-center justify-center rounded-[3px] font-mono text-xs text-muted hover:bg-background hover:text-foreground"
        >
          ←
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-1">
        <Node
          node={tree}
          depth={0}
          active={active}
          onOpen={openFile}
          onContext={(e, path) => {
            e.preventDefault();
            setMenu({ x: e.clientX, y: e.clientY, path });
          }}
        />
      </div>

      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div
            className="grad-border fixed z-50 rounded-[6px] bg-surface py-1 shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
            style={{ left: menu.x, top: menu.y }}
          >
            <button
              onClick={() => {
                setMenu(null);
                onSaveTemplate();
              }}
              className="block w-full px-3 py-1.5 text-left font-mono text-[11px] text-foreground hover:bg-surface-elevated hover:text-accent"
            >
              Save as template
            </button>
          </div>
        </>
      )}
    </div>
  );
}
