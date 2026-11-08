"use client";

import { useState } from "react";

export const AVATARS = [
  "🦁",
  "🐯",
  "🐰",
  "🦉",
  "🐶",
  "🐱",
  "🐼",
  "🐨",
  "🦊",
  "🐻",
  "🐸",
  "🐵",
  "🐧",
  "🐬",
  "🦄",
  "🐲",
  "🦖",
  "🐢",
  "🦋",
  "🐝",
  "⚽",
  "🏃",
  "🎮",
  "🚀",
  "🤖",
  "🌟",
  "🌈",
  "🍀",
  "🍕",
  "🎸",
  "🧙",
  "🥷",
];

/** 點頭像就能換：從一組圖示裡挑一個。孩子自己也能用。 */
export function AvatarPicker({
  value,
  onChange,
  size = "text-5xl",
}: {
  value: string;
  onChange: (a: string) => void | Promise<void>;
  size?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button type="button" title="換頭像" aria-label="換頭像" className={`${size} leading-none`} onClick={() => setOpen(!open)}>
        {value}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-2 grid w-72 grid-cols-8 gap-1 rounded-xl border border-black/15 bg-white p-2 shadow-lg dark:border-white/20 dark:bg-neutral-900">
          {AVATARS.map((a) => (
            <button
              key={a}
              type="button"
              className={`rounded-lg p-1 text-2xl hover:bg-black/10 dark:hover:bg-white/10 ${a === value ? "ring-2 ring-teal-500" : ""}`}
              onClick={async () => {
                setOpen(false);
                if (a !== value) await onChange(a);
              }}
            >
              {a}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
