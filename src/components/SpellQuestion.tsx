"use client";

import { useMemo, useRef, useState } from "react";
import { sameAnswer } from "@/lib/games";
import { analyzeWord, findRoots, hintPattern, spellChunks, spellDiff } from "@/lib/morph";
import type { WordPart } from "@/lib/types";
import { SayButton, SpeakControls } from "@/components/SpeakControls";
import type { SpeedPlace } from "@/lib/speech-speed";

/**
 * 拼寫題：看中文、聽發音，打出單字。題目把字拆成字首、音節、字尾的小塊，並提示字尾的詞性和常見字母組合。
 * 打錯會逐塊標出哪幾塊拼對，拼對過的塊之後直接填好；錯越多次提示越多（每塊首字母、再加尾字母），字根先只給意思、錯一次才給拼法。
 * 錯兩次可以看答案，但要照著打一遍才能下一題。第一次就拼對才算對。
 * 有整理過的字首字根字尾（parts）就照它切塊、列出各部分的意思。
 */
const KIND: Record<WordPart["kind"], string> = { prefix: "字首", root: "字根", suffix: "字尾" };

export function SpellQuestion({
  word,
  meaning,
  parts: curated,
  onPlay,
  place,
  onDone,
}: {
  word: string;
  meaning: string;
  parts?: WordPart[];
  onPlay?: (rate: number) => void;
  place?: SpeedPlace;
  onDone: (correct: boolean) => void;
}) {
  const doneRef = useRef(false);
  const [typed, setTyped] = useState("");
  const [tries, setTries] = useState<string[]>([]);
  const [solved, setSolved] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const last = tries[tries.length - 1];
  const parts = useMemo(() => ({ ...analyzeWord(word), chunks: spellChunks(word, curated) }), [word, curated]);
  const roots = useMemo(() => (curated ? [] : findRoots(word)), [word, curated]);

  /** 上一次拼錯差在哪：開頭、結尾對了幾個字母，中間要補什麼。 */
  const diff = useMemo(() => (last ? spellDiff(last, word) : null), [last, word]);

  /** 任何一次拼對過的塊。 */
  const known = useMemo(() => {
    const k = new Set<number>();
    for (const t of tries) {
      const { head, tail } = spellDiff(t, word);
      let pos = 0;
      parts.chunks.forEach((c, i) => {
        if (pos + c.length <= head || pos >= word.length - tail) k.add(i);
        pos += c.length;
      });
    }
    return k;
  }, [tries, parts, word]);
  const pattern = hintPattern(parts.chunks, tries.length, known);

  function check() {
    if (!typed.trim()) return;
    if (sameAnswer(typed, word)) setSolved(true);
    else {
      setTries([...tries, typed.trim()]);
      setTyped("");
    }
  }

  return (
    <div className="card space-y-4">
      <p className="text-sm text-black/60 dark:text-white/60">聽發音、看意思，拼出這個字</p>
      <div className="text-center">
        <p className="text-3xl font-medium">{meaning}</p>
        <p className="mt-2 font-mono text-xl tracking-[0.3em] text-black/50 dark:text-white/50">{pattern.join(" · ")}</p>
        <p className="text-xs text-black/50 dark:text-white/50">
          共 {parts.chunks.length} 塊（字首、音節、字尾）
          {tries.length === 1 && "・拼對的塊已經填好"}
          {tries.length === 2 && "・多給你每塊的第一個字母"}
          {tries.length >= 3 && "・再多給每塊的最後一個字母"}
        </p>
      </div>
      {curated ? (
        <ul className="space-y-1 rounded-xl bg-black/5 p-3 text-sm dark:bg-white/10">
          {curated.map((p) => (
            <li key={p.text}>
              {KIND[p.kind]} {p.kind !== "root" || tries.length ? <strong className="font-mono">{p.text}</strong> : "（錯一次後顯示拼法）"}
              ：{p.meaning}
            </li>
          ))}
        </ul>
      ) : (
        (parts.prefix || parts.suffix || parts.combos.length > 0 || roots.length > 0) && (
          <ul className="space-y-1 rounded-xl bg-black/5 p-3 text-sm dark:bg-white/10">
            {parts.prefix && (
              <li>
                字首 <strong className="font-mono">{parts.prefix.text}-</strong>：{parts.prefix.meaning}
              </li>
            )}
            {parts.suffix && (
              <li>
                字尾 <strong className="font-mono">-{parts.suffix.text}</strong>：{parts.suffix.meaning}
                {parts.suffix.pos && <span className="ml-1 rounded bg-teal-100 px-1 text-teal-900">{parts.suffix.pos}</span>}
              </li>
            )}
            {roots.map((r) => (
              <li key={r.text}>
                字根 {tries.length ? <strong className="font-mono">{r.text}</strong> : "（錯一次後顯示拼法）"}：{r.meaning}
                {tries.length > 0 && r.examples.some((e) => e !== word.toLowerCase()) && (
                  <span className="ml-1 text-black/50 dark:text-white/50">
                    同字根：
                    {r.examples.filter((e) => e !== word.toLowerCase()).join("、")}
                  </span>
                )}
              </li>
            ))}
            {parts.combos.length > 0 && (
              <li>
                注意組合：
                {parts.combos.map((c) => (
                  <strong key={c} className="mr-2 font-mono">
                    {c}
                  </strong>
                ))}
              </li>
            )}
          </ul>
        )
      )}
      {onPlay && (
        <div className="flex justify-center">
          <SayButton onPlay={onPlay} place={place} label="聽發音" />
        </div>
      )}
      {onPlay && <SpeakControls onPlay={onPlay} place={place} playLabel="聽發音" />}
      {last && diff && !solved && (
        <div className="text-center">
          <p className="font-mono text-xl tracking-widest">
            <span className="text-green-700 dark:text-green-400">{last.slice(0, diff.head)}</span>
            {diff.middle && <span className="text-red-700 line-through dark:text-red-400">{diff.middle}</span>}
            <span className="text-black/40 dark:text-white/40">{"＿".repeat(Math.max(diff.gap, 0))}</span>
            <span className="text-green-700 dark:text-green-400">{last.slice(last.length - diff.tail)}</span>
          </p>
          <p className="text-sm text-black/60 dark:text-white/60">
            開頭 {diff.head} 個、結尾 {diff.tail} 個字母對了，
            {diff.gap === 0
              ? `中間多打了「${diff.middle}」`
              : `中間${diff.middle ? `「${diff.middle}」不對，` : ""}應該是 ${diff.gap} 個字母`}
          </p>
        </div>
      )}
      {revealed && !solved && (
        <p className="text-center text-lg">
          正確拼法：
          <strong className="font-mono">{parts.chunks.join(" · ")}</strong>
          　照著打一次
        </p>
      )}
      {!solved ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            check();
          }}
        >
          <input
            className="flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 font-mono text-xl dark:border-white/20"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            lang="en"
            autoFocus
          />
          <button type="submit" className="btn" disabled={!typed.trim()}>
            檢查
          </button>
          {tries.length >= 2 && !revealed && (
            <button type="button" className="btn-ghost text-sm" onClick={() => setRevealed(true)}>
              看答案
            </button>
          )}
        </form>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className={tries.length ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"}>
            {tries.length ? `拼出來了：${word}，之後會再複習。` : `答對了！${word}`}
          </p>
          <button type="button" className="btn shrink-0" onClick={() => {
            if (doneRef.current) return;
            doneRef.current = true;
            onDone(!tries.length && !revealed);
          }}>
            下一題
          </button>
        </div>
      )}
    </div>
  );
}
