"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { REGISTER_LABEL } from "@/content";
import { ScoreDot } from "@/components/ScoreDot";
import { ScoreSource } from "@/components/ScoreSource";
import { ShadowRecorder } from "@/components/ShadowRecorder";
import { bandLine, keepBest, loadBest, saveBest } from "@/lib/score-band";
import { PASS_SCORE, scoreShadow, type ShadowResult } from "@/lib/speech-score";
import type { Recording } from "@/lib/speech";
import { partChunkIndexes, partMeaning, spellChunks } from "@/lib/morph";
import { canSpeak, speak, type SpeakProgress } from "@/lib/speech";
import { rateFor, useSpeed } from "@/lib/speech-speed";
import type { StudyItem, WordPart } from "@/lib/types";
import { SpeedButton } from "@/components/SpeakControls";

/** 字首、字根、字尾用不同底色區分（泡泡上不再寫「字首」等字樣）。 */
const KIND_COLOR: Record<WordPart["kind"], string> = {
  prefix: "bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100",
  root: "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100",
  suffix: "bg-teal-100 text-teal-900 dark:bg-teal-900 dark:text-teal-100",
};

/**
 * 單字只唸一下，語音不會回報唸到哪個音節，所以用唸的時間估計：從開始唸起，
 * 依每一塊的字母數一塊一塊往下亮。唸完（或換卡片）就熄掉。
 */
function useChunkLight(chunks: string[], rate: number, resetKey: unknown) {
  const [lit, setLit] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const running = useRef(false);
  const stop = useCallback(() => {
    clearTimeout(timer.current);
    running.current = false;
    setLit(-1);
  }, []);
  useEffect(() => stop, [resetKey, stop]);
  const onProgress = useCallback(
    (p: SpeakProgress | null) => {
      if (!p) return stop();
      if (running.current) return;
      running.current = true;
      const step = (i: number) => {
        if (i >= chunks.length) return stop();
        setLit(i);
        timer.current = setTimeout(() => step(i + 1), Math.max(220, (chunks[i].length * 95) / rate));
      };
      timer.current = setTimeout(() => step(0), 150);
    },
    [chunks, rate, stop],
  );
  return { lit, onProgress };
}

/**
 * 學新字：練習前先一張一張看。英文字拆成好拼的小塊，有字首字根字尾就標出各部分的意思；
 * 可以聽正常速度和慢速，看完再開始選意思、拼寫。
 */
export function StudyCards({
  learnerId,
  items,
  onDone,
}: {
  learnerId: string;
  items: StudyItem[];
  onDone: () => void;
}) {
  const [index, setIndex] = useState(0);
  // 看過的最後一張：看過的字會排到左邊，可以點回去個別再練。
  const [seen, setSeen] = useState(0);
  const [best, setBest] = useState<Record<number, number>>(() => {
    const all = loadBest(learnerId, SAY_KEY);
    return Object.fromEntries(
      items
        .map((it, i) => [i, all[hash(it.id)]])
        .filter(([, v]) => v !== undefined),
    );
  });
  const [result, setResult] = useState<Record<number, ShadowResult>>({});
  const [pending, setPending] = useState<Record<number, boolean>>({});
  const item = items[index] as StudyItem | undefined;
  const speed = useSpeed("cards");
  const chunks = item?.language === "en" ? spellChunks(item.prompt, item.parts) : [];
  const { lit, onProgress } = useChunkLight(chunks, speed.rate, index);
  if (!item) return null;
  const say = (rate: number) =>
    speak(item.speak ?? item.prompt, item.language, rate, chunks.length > 1 ? onProgress : undefined);
  const light = (i: number) => (lit === i ? "rounded bg-amber-300 text-black dark:bg-amber-500" : lit > i ? "text-teal-700 dark:text-teal-300" : "");
  const partChunks = item.parts && chunks.length ? partChunkIndexes(chunks, item.parts) : [];

  async function scored(rec: Recording) {
    const i = index;
    const it = items[i];
    setPending((p) => ({ ...p, [i]: true }));
    try {
      const r = await scoreShadow(it.speak ?? it.prompt, rec, it.language);
      setResult((all) => ({ ...all, [i]: r }));
      setBest((b) => keepBest(b, i, r.score));
      const all = loadBest(learnerId, SAY_KEY);
      saveBest(learnerId, SAY_KEY, keepBest(all, hash(it.id), r.score));
    } finally {
      setPending((p) => ({ ...p, [i]: false }));
    }
  }

  function go(next: number) {
    setIndex(next);
    setSeen((s) => Math.max(s, next));
    const n = items[next];
    if (n && canSpeak()) speak(n.speak ?? n.prompt, n.language, rateFor("cards"));
  }

  const said = result[index];
  return (
    <div className="flex flex-col gap-3 md:flex-row-reverse md:items-start">
      <div className="card flex-1 space-y-4">
        <div className="flex items-center justify-between text-sm text-black/60 dark:text-white/60">
          <span>
            先認識新字 {index + 1} / {items.length}
          </span>
          <button type="button" className="btn-ghost text-sm" onClick={onDone}>
            直接開始練習
          </button>
        </div>
        <div className="space-y-2 text-center">
          <button
            type="button"
            disabled={!canSpeak()}
            onClick={() => say(speed.rate)}
            aria-label="點一下聽單字發音"
            className="w-full rounded-xl py-1 text-5xl font-medium active:bg-black/5 dark:active:bg-white/10"
          >
            {chunks.length > 1 ? chunks.map((c, i) => <span key={i} className={light(i)}>{c}</span>) : item.prompt}
          </button>
          {(item.language === "ja" || item.language === "es") && item.extra && (
            <p className="text-lg text-black/50 dark:text-white/50">{item.extra}</p>
          )}
          {chunks.length > 1 && (
            <p className="font-mono text-2xl tracking-wide">
              {chunks.map((c, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-black/30 dark:text-white/30"> · </span>}
                  <span className={light(i)}>{c}</span>
                </span>
              ))}
            </p>
          )}
          {item.parts && (
            <div className="flex flex-wrap items-stretch justify-center gap-2">
              {item.parts.map((p, i) => {
                const on = partChunks[i]?.includes(lit);
                return (
                  <span
                    key={i}
                    className={`rounded-xl px-3 py-1 text-center transition ${KIND_COLOR[p.kind]} ${on ? "scale-110 ring-2 ring-amber-400" : lit >= 0 && !on ? "opacity-60" : ""}`}
                  >
                    <span className="block font-mono text-lg font-medium">{p.text}</span>
                    <span className="block text-xs opacity-80">{partMeaning(p.meaning)}</span>
                  </span>
                );
              })}
            </div>
          )}
          {canSpeak() && (
            <p className="flex items-center justify-center gap-2 text-sm text-black/60 dark:text-white/60">
              <span>🔈 點上面的單字聽發音</span>
              <SpeedButton place="cards" withName className="h-8 text-sm" />
            </p>
          )}
          <p className="text-2xl">{item.answer}</p>
          {item.register && (
            <p className="text-sm text-black/60 dark:text-white/60">
              <span className="rounded bg-violet-100 px-2 py-0.5 text-violet-900 dark:bg-violet-900 dark:text-violet-100">
                {REGISTER_LABEL[item.register]}
              </span>
              {item.usage && <span className="ml-2">{item.usage}</span>}
            </p>
          )}
        </div>
        <div className="space-y-2 rounded-xl border border-black/10 p-3 dark:border-white/15">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-black/60 dark:text-white/60">
              按 🎤 跟著唸一次，AI 老師幫你檢查發音（錄音不會存下來）
            </p>
            <ShadowRecorder
              key={index}
              iconOnly
              language={item.language}
              label={said ? "再唸一次" : "唸唸看"}
              disabled={pending[index]}
              onRecorded={(rec) => scored(rec)}
            />
          </div>
          {said && (
            <div className="space-y-1 text-sm">
              <p><b>{bandLine(said.score, best[index])}</b></p>
              <ScoreSource by={said.by} note={said.note} />
              <p className="text-black/60 dark:text-white/60">
                聽到：「{said.heard || "（沒聽到）"}」{said.score >= PASS_SCORE ? "" : "，再聽一次示範後重唸"}
              </p>
              {said.tip && <p className="font-medium">{said.tip}</p>}
              {said.issues.map((x, i) => (
                <p key={i}>
                  <span className="font-semibold">{x.word}</span>：{x.fix}
                </p>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-between gap-2">
          <button
            type="button"
            className="btn-ghost"
            disabled={index === 0}
            onClick={() => go(index - 1)}
          >
            上一張
          </button>
          {index + 1 < items.length ? (
            <button type="button" className="btn" onClick={() => go(index + 1)}>
              下一張
            </button>
          ) : (
            <button type="button" className="btn" onClick={onDone}>
              開始練習
            </button>
          )}
        </div>
      </div>
      {seen > 0 && (
        <aside
          className="card space-y-1 md:w-48 md:shrink-0"
          aria-label="看過的字"
        >
          <p className="text-xs text-black/60 dark:text-white/60">
            看過的（點一下再練）
          </p>
          <div className="flex flex-wrap gap-1 md:flex-col">
            {items.slice(0, seen + 1).map((it, i) => (
              <button
                key={it.id}
                type="button"
                onClick={() => setIndex(i)}
                className={`flex items-center gap-2 rounded-lg border px-2 py-1 text-left text-sm ${i === index ? "border-teal-700 bg-teal-50 dark:bg-teal-950" : "border-black/15 dark:border-white/20"}`}
              >
                {pending[i] ? (
                  <span title="AI 評分中">⏳</span>
                ) : (
                  <ScoreDot score={best[i]} />
                )}
                <span className="truncate">{it.prompt}</span>
              </button>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}

const SAY_KEY = "vocab-say";

/** 用字卡 id 當 localStorage 的 key（loadBest 用數字索引）。 */
function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h;
}
