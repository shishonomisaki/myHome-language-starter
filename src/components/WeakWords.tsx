"use client";

import { ScoreDot } from "@/components/ScoreDot";
import { useEffect, useState } from "react";
import { CLEAR_STREAK, HABIT_TIP, habits, ISSUE_LABEL, listenQuiz, STUBBORN_MISSES, type PronWeak } from "@/lib/pron-weak";
import { ScoreSource } from "@/components/ScoreSource";
import { bandLine } from "@/lib/score-band";
import type { ShadowResult } from "@/lib/speech-score";
import { speak } from "@/lib/speech";
import type { Language } from "@/lib/types";

/**
 * 加強發音單元最上面：跟讀時一再被 AI 老師抓到的字。點一張卡選它（會唸給你聽），
 * 再按右下角朗讀列的 🎤 唸唸看；連續唸對 CLEAR_STREAK 次就從清單畢業。
 */
export function WeakWords({
  words,
  language,
  selected,
  onSelect,
  results,
}: {
  words: PronWeak[];
  language: Language;
  selected: number;
  onSelect: (i: number) => void;
  results: Record<number, ShadowResult>;
}) {
  const [round, setRound] = useState(0);
  const [guess, setGuess] = useState<string | null>(null);
  // 「我聽不出來」：這個字先不做聽辨，改練嘴型和唸唸看（只記在這台裝置）。
  const [skip, setSkip] = useState<string[]>([]);
  useEffect(() => {
    try {
      setSkip(JSON.parse(localStorage.getItem("myhome-language:pron-skip") ?? "[]"));
    } catch {
      // 讀不到就當作都沒跳過。
    }
  }, []);
  function toggleSkip(word: string) {
    const next = skip.includes(word) ? skip.filter((x) => x !== word) : [...skip, word];
    setSkip(next);
    try {
      localStorage.setItem("myhome-language:pron-skip", JSON.stringify(next));
    } catch {
      // 存不進去也沒關係。
    }
  }
  if (!words.length) return null;
  const hs = habits(words);
  const quiz = (w: PronWeak) => listenQuiz(w.word, w.pair, round);
  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">🎯 你常唸不好的字</h2>
      <p className="text-sm text-black/60 dark:text-white/60">
        跟讀時 AI 老師一直提醒的字。點一下聽，再按右下角 🎤 唸唸看；連續唸對 {CLEAR_STREAK} 次就畢業。
      </p>
      {hs.length > 0 && (
        <div className="space-y-1 rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-950">
          {hs.slice(0, 2).map((h) => (
            <p key={h.kind}>
              <span className="font-semibold">
                習慣：{ISSUE_LABEL[h.kind]}（{h.words} 個字、共 {h.count} 次）
              </span>
              <br />
              {HABIT_TIP[h.kind]}
            </p>
          ))}
        </div>
      )}
      <ul className="space-y-2">
        {words.map((w, i) => {
          const r = results[i];
          const on = i === selected;
          return (
            <li key={w.word}>
              <button
                type="button"
                onClick={() => {
                  onSelect(i);
                  speak(w.word, language, 0.7);
                }}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  on ? "border-amber-400 bg-amber-50 dark:border-amber-500 dark:bg-amber-950" : "border-black/10 dark:border-white/15"
                }`}
              >
                <p className="flex flex-wrap items-center gap-2">
                  {r && <ScoreDot score={r.score} />}
                  <span className="text-xl font-semibold">{w.word}</span>
                  <span className="text-xs text-black/60 dark:text-white/60">{ISSUE_LABEL[w.kind] ?? ISSUE_LABEL.other}</span>
                  {w.misses >= STUBBORN_MISSES && <span className="rounded-full bg-red-100 px-2 text-xs text-red-800 dark:bg-red-900 dark:text-red-100">頑固</span>}
                  <span className="ml-auto text-xs text-black/50 dark:text-white/50">
                    被提醒 {w.misses} 次・已連續唸對 {w.clean_streak}/{CLEAR_STREAK}
                  </span>
                </p>
                {w.fix && <p className="mt-1 text-sm">{w.fix}</p>}
              </button>
              {on && w.pair.length > 1 && (
                <div className="mt-1 flex flex-wrap items-center gap-2 pl-1">
                  <span className="text-xs text-black/60 dark:text-white/60">聽聽看差在哪：</span>
                  {w.pair.map((p) => (
                    <button key={p} type="button" className="btn-ghost text-sm" onClick={() => speak(p, language, 0.6)}>
                      🔊 {p}
                    </button>
                  ))}
                </div>
              )}
              {on && quiz(w) && skip.includes(w.word) && (
                <p className="mt-2 pl-1 text-sm text-black/70 dark:text-white/70">
                  聽辨先跳過，照上面的嘴型和長短，用右下角 🎤 唸唸看就好。
                  <button type="button" className="ml-2 underline" onClick={() => toggleSkip(w.word)}>
                    我想再試試聽辨
                  </button>
                </p>
              )}
              {on && quiz(w) && !skip.includes(w.word) && (
                <div className="mt-2 space-y-1 pl-1 text-sm">
                  <p className="text-xs text-black/60 dark:text-white/60">聽辨：聽一個字，選你聽到的是哪個。</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className="btn-ghost text-sm" onClick={() => speak(quiz(w)!.answer, language, 0.6)}>
                      🔊 播放
                    </button>
                    {quiz(w)!.choices.map((c) => (
                      <button
                        key={c}
                        type="button"
                        disabled={guess !== null}
                        onClick={() => setGuess(c)}
                        className={`rounded-xl border px-3 py-1 ${guess === null ? "border-black/15 dark:border-white/20" : c === quiz(w)!.answer ? "border-green-600 bg-green-50 dark:bg-green-950" : c === guess ? "border-red-600 bg-red-50 dark:bg-red-950" : "opacity-50"}`}
                      >
                        {c}
                      </button>
                    ))}
                    <button type="button" className="btn-ghost text-sm" onClick={() => { setGuess(null); toggleSkip(w.word); }}>
                      我聽不出來
                    </button>
                    {guess !== null && (
                      <button type="button" className="btn-ghost text-sm" onClick={() => { setGuess(null); setRound((n) => n + 1); }}>
                        {guess === quiz(w)!.answer ? "答對了！再來一題" : `是 ${quiz(w)!.answer}，再來一題`}
                      </button>
                    )}
                  </div>
                </div>
              )}
              {on && r && (
                <div className="mt-1 space-y-1 pl-1 text-sm">
                  <p className="font-semibold">{bandLine(r.score)}</p>
                  {r.tip && <p>{r.tip}</p>}
                  <ScoreSource by={r.by} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
