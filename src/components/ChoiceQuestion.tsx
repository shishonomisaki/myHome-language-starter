"use client";

import { useRef, useState } from "react";
import { SpeakText } from "@/components/SpeakText";
import type { Language } from "@/lib/types";
import { SayButton, SpeakControls } from "@/components/SpeakControls";
import type { SpeedPlace } from "@/lib/speech-speed";

/**
 * 選擇題卡。
 * - practice（預設）：答錯不直接公布答案，標紅讓他再想一次；錯兩次才能按「看答案」。第一次就答對才算對。
 * - test：分級測驗用，不顯示對錯，選了就到下一題。
 */
export function ChoiceQuestion({
  title,
  prompt,
  hint,
  language,
  choices,
  answerIndex,
  onPlay,
  place,
  onDone,
  choiceClassName = "text-lg",
  mode = "practice",
}: {
  title: string;
  prompt?: React.ReactNode;
  hint?: string;
  /** 有給就讓解說裡的外語例句可以點來唸。 */
  language?: Language;
  choices: string[];
  answerIndex: number;
  onPlay?: (rate: number) => void;
  /** 語速記在哪個地方（單字、聽力…各記各的）。 */
  place?: SpeedPlace;
  onDone: (correct: boolean) => void;
  choiceClassName?: string;
  mode?: "practice" | "test";
}) {
  const [wrong, setWrong] = useState<number[]>([]);
  const [solved, setSolved] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const answered = solved || revealed;
  // 每題只回報一次：連點「下一題」或選項不能重複記分（曾出現答對 13/12）。
  const done = useRef(false);
  const finish = (ok: boolean) => {
    if (done.current) return;
    done.current = true;
    onDone(ok);
  };

  function pick(i: number) {
    if (mode === "test") return finish(i === answerIndex);
    if (i === answerIndex) setSolved(true);
    else setWrong([...wrong, i]);
  }

  return (
    <div className="card space-y-4">
      <p className="text-sm text-black/60 dark:text-white/60">{title}</p>
      {prompt && <div className="text-center">{prompt}</div>}
      {onPlay && (
        <div className="flex items-center justify-center gap-3">
          <SayButton onPlay={onPlay} place={place} label="播放" />
          <span className="text-sm">按 🔊 聽，可以聽很多次</span>
        </div>
      )}
      {onPlay && <SpeakControls onPlay={onPlay} place={place} playLabel="再聽一次" />}
      <div className="grid grid-cols-2 gap-3">
        {choices.map((c, i) => {
          const state =
            answered && i === answerIndex
              ? "border-green-600 bg-green-50 dark:bg-green-950"
              : wrong.includes(i)
                ? "border-red-600 bg-red-50 opacity-60 dark:bg-red-950"
                : answered
                  ? "opacity-50"
                  : "";
          return (
            <button
              key={c + i}
              type="button"
              disabled={answered || wrong.includes(i)}
              onClick={() => pick(i)}
              className={`rounded-xl border border-black/15 px-3 py-4 dark:border-white/20 ${choiceClassName} ${state}`}
            >
              {c}
            </button>
          );
        })}
      </div>
      {!answered && wrong.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-red-700 dark:text-red-400">不對，再想想看。</p>
          {wrong.length >= 2 && (
            <button type="button" className="btn-ghost shrink-0 text-sm" onClick={() => setRevealed(true)}>
              看答案
            </button>
          )}
        </div>
      )}
      {answered && (
        <div className="flex items-center justify-between gap-3">
          <p className={solved && !wrong.length ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>
            {revealed ? `正確答案：${choices[answerIndex]}` : wrong.length ? "這次答對了，這個字之後會再複習。" : "答對了！"}
            {hint && (
              <span className="block text-sm text-black/60 dark:text-white/60">
                {language ? <SpeakText mixed text={hint} language={language} /> : hint}
              </span>
            )}
          </p>
          <button type="button" className="btn shrink-0" onClick={() => finish(solved && !wrong.length)}>
            下一題
          </button>
        </div>
      )}
    </div>
  );
}
