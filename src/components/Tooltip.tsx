"use client";

import { useRef, useState, type ReactNode } from "react";

/**
 * Dark-pill tooltip: appears 400ms after hover, hides on mouseout, never blocks
 * the element (pointer-events-none, sits above it). Geist Mono, small.
 */
export function Tooltip({
  label,
  children,
  side = "bottom",
}: {
  label: string;
  children: ReactNode;
  side?: "bottom" | "top";
}) {
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function enter() {
    timer.current = setTimeout(() => setShow(true), 400);
  }
  function leave() {
    if (timer.current) clearTimeout(timer.current);
    setShow(false);
  }

  return (
    <span className="relative inline-flex" onMouseEnter={enter} onMouseLeave={leave}>
      {children}
      {show && (
        <span
          className={`pointer-events-none absolute left-1/2 z-[80] -translate-x-1/2 whitespace-nowrap rounded-[5px] border border-border bg-[#1a1a1a] px-2 py-1 font-mono text-[10px] text-foreground shadow-[0_4px_16px_rgba(0,0,0,0.6)] ${
            side === "bottom" ? "top-[calc(100%+6px)]" : "bottom-[calc(100%+6px)]"
          }`}
        >
          {label}
        </span>
      )}
    </span>
  );
}
