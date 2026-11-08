"use client";

import { useState } from "react";
import { Highlighted } from "@/components/Highlighted";
import { canSpeak, pauseSpeaking, resumeSpeaking, speak, speakState, type SpeakProgress } from "@/lib/speech";
import { rateFor, type SpeedPlace } from "@/lib/speech-speed";
import type { Language } from "@/lib/types";
import { speakableSegments } from "@/lib/speak-segments";

/** 現在唸的是哪一個 SpeakText 的哪一句；每次開始唸都換一個新的 listener，被別處搶走或唸完就清掉。 */
let owner: { key: string; listener: (p: SpeakProgress | null) => void } | null = null;

/**
 * 全站共用：文字裡的每一句都可以直接點來唸，並且卡拉OK亮燈（跟短文閱讀一樣）。
 *   點一句 → 只唸這一句；唸完前再點同一句 → 暫停；再點 → 從停住的字接著唸；唸完再點 → 重唸。
 * 浮動 🔊 圓鈕（SpeakControls）會自動展開，可以換速、暫停。
 * mixed：中文解說裡夾外語例句時用，只有外語片段可以點。
 * 新的練習頁顯示例句、短文、題目句子時，一律用這個元件，不要另做朗讀鈕。
 */
export function SpeakText({
  text,
  language,
  place = "general",
  mixed = false,
  className = "",
}: {
  text: string;
  language: Language;
  place?: SpeedPlace;
  mixed?: boolean;
  className?: string;
}) {
  const [at, setAt] = useState<{ seg: number; p: SpeakProgress } | null>(null);
  const segs = speakableSegments(text, language, mixed);
  if (!segs.length || !canSpeak()) return <span className={className}>{text}</span>;
  const id = `${language}:${text}`;

  const tap = (i: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const key = `${id}#${i}`;
    const st = speakState();
    if (owner?.key === key && st === "speaking") return pauseSpeaking();
    if (owner?.key === key && st === "paused") return resumeSpeaking();
    const listener = (p: SpeakProgress | null) => {
      if (p) return setAt({ seg: i, p });
      setAt(null);
      if (owner?.listener === listener) owner = null;
    };
    owner = { key, listener };
    void speak(segs[i].text, language, rateFor(place), listener);
  };

  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  segs.forEach((s, i) => {
    if (s.start > cursor) pieces.push(text.slice(cursor, s.start));
    pieces.push(
      <span
        key={i}
        role="button"
        tabIndex={0}
        title="點一下唸這句；再點暫停／繼續"
        onClick={(e) => tap(i, e)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            tap(i, e as unknown as React.MouseEvent);
          }
        }}
        className="cursor-pointer rounded decoration-teal-600/40 decoration-dotted underline-offset-4 hover:underline"
      >
        <Highlighted text={s.text} progress={at?.seg === i ? at.p : null} />
      </span>,
    );
    cursor = s.start + s.text.length;
  });
  if (cursor < text.length) pieces.push(text.slice(cursor));
  return <span className={className}>{pieces}</span>;
}
