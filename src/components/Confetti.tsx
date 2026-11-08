"use client";

import { useEffect, useState } from "react";

const COLORS = ["#2dd4bf", "#f5b351", "#f87171", "#60a5fa", "#a78bfa"];

/** 全部過關的彩紙：掛上去就從上方飄下 2 秒，之後自己消失（不擋住操作）。 */
export function Confetti() {
  const [pieces] = useState(() =>
    Array.from({ length: 28 }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 0.4, color: COLORS[i % COLORS.length] })),
  );
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGone(true), 2400);
    return () => clearTimeout(t);
  }, []);
  if (gone) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p, i) => (
        <i key={i} className="confetti-piece" style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s` }} />
      ))}
    </div>
  );
}
