"use client";

// Word-by-word blur-in headline. Pure CSS (blur-in keyframe in globals.css),
// no framer-motion dependency. 80ms stagger per word.
export function BlurText({ text, className }: { text: string; className?: string }) {
  const words = text.split(" ");
  return (
    <span className={className}>
      {words.map((w, i) => (
        <span key={i} className="blur-word" style={{ animationDelay: `${i * 80}ms` }}>
          {w}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}
