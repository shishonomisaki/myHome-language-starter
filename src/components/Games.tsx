"use client";

import { useMemo, useState } from "react";
import { blankOut, confusableGroups, dictationScore, joinChunks, labelAmbiguousPairs, POS_TIPS, posName, withPos, letterTiles, sameAnswer, scrambled, sentenceChunks } from "@/lib/games";
import { canSpeak, speak } from "@/lib/speech";
import { rateFor } from "@/lib/speech-speed";
import type { FocusArea, Language } from "@/lib/types";
import { SayButton } from "@/components/SpeakControls";
import { SpeakText } from "@/components/SpeakText";

export interface GameResult {
  id: string;
  correct: boolean;
}

type Done = (r: GameResult) => void;

const tile = "rounded-xl border border-black/15 px-3 py-2 dark:border-white/20";

/** 拼句：點字塊排出正確順序。 */
function OrderGame({ sentence, language, id, onDone }: { sentence: string; language: Language; id: string; onDone: Done }) {
  const chunks = useMemo(() => sentenceChunks(sentence), [sentence]);
  const pool = useMemo(() => scrambled(chunks.map((c, i) => ({ c, i }))), [chunks]);
  const [picked, setPicked] = useState<number[]>([]);
  const [result, setResult] = useState<boolean | null>(null);
  const joiner = language === "en" ? " " : "";
  const built = picked.map((i) => chunks[i]).join(joiner);

  function check() {
    const ok = sameAnswer(built, chunks.join(joiner));
    setResult(ok);
    onDone({ id, correct: ok });
  }

  return (
    <div className="space-y-2">
      <p className="min-h-10 rounded-xl bg-black/5 p-2 text-lg dark:bg-white/10">{built || "點下面的字塊排成句子"}</p>
      <div className="flex flex-wrap gap-2">
        {pool.map(({ c, i }) => (
          <button key={i} type="button" className={`${tile} ${picked.includes(i) ? "opacity-30" : ""}`} disabled={picked.includes(i) || result !== null} onClick={() => setPicked([...picked, i])}>
            {c}
          </button>
        ))}
      </div>
      {result === null ? (
        <div className="flex gap-2">
          <button type="button" className="btn-ghost text-sm" disabled={!picked.length} onClick={() => setPicked(picked.slice(0, -1))}>
            ↩ 退一格
          </button>
          <button type="button" className="btn text-sm" disabled={picked.length !== chunks.length} onClick={check}>
            檢查
          </button>
        </div>
      ) : (
        <p className={result ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>
          {result ? "✅ 對了" : `正確：${chunks.join(joiner)}`}
        </p>
      )}
    </div>
  );
}

/** 配對：點一個英文（會念出來）再點一個意思，配成一對；先點哪一邊都可以。 */
function MatchGame({ pairs, language, id, onDone }: { pairs: { term: string; meaning: string }[]; language: Language; id: string; onDone: Done }) {
  const right = useMemo(() => scrambled(pairs.map((p, i) => ({ m: p.meaning, i }))), [pairs]);
  const [left, setLeft] = useState<number | null>(null);
  const [rightPick, setRightPick] = useState<number | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [misses, setMisses] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);

  function tryPair(l: number, r: number) {
    if (l === r) {
      const next = [...matched, l];
      setMatched(next);
      if (next.length === pairs.length) onDone({ id, correct: misses <= 1 });
    } else {
      setMisses(misses + 1);
      setWrong(r);
      setTimeout(() => setWrong(null), 600);
    }
    setLeft(null);
    setRightPick(null);
  }

  function pickLeft(i: number) {
    if (canSpeak()) speak(pairs[i].term, language, rateFor("cards"));
    if (rightPick !== null) tryPair(i, rightPick);
    else setLeft(left === i ? null : i);
  }

  function pickRight(i: number) {
    if (left !== null) tryPair(left, i);
    else setRightPick(rightPick === i ? null : i);
  }

  const chosen = "!border-teal-600 ring-2 ring-teal-500 bg-teal-50 font-semibold dark:bg-teal-950";
  const done = matched.length === pairs.length;

  return (
    <div className="space-y-2">
      {!done && (
        <p className="text-sm text-black/70 dark:text-white/70">
          {left !== null ? "👉 再點右邊的中文意思" : rightPick !== null ? "👉 再點左邊對應的詞" : "先點左邊一個詞（會念給你聽），再點右邊的意思"}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          {pairs.map((p, i) => (
            <button
              key={i}
              type="button"
              aria-pressed={left === i}
              disabled={matched.includes(i)}
              onClick={() => pickLeft(i)}
              className={`${tile} min-h-12 w-full text-left ${matched.includes(i) ? "border-green-600 opacity-50" : left === i ? chosen : ""}`}
            >
              {left === i ? "✔ " : ""}
              {p.term}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {right.map(({ m, i }) => (
            <button
              key={i}
              type="button"
              aria-pressed={rightPick === i}
              disabled={matched.includes(i)}
              onClick={() => pickRight(i)}
              className={`${tile} min-h-12 w-full text-left ${matched.includes(i) ? "border-green-600 opacity-50" : wrong === i ? "!border-red-600 bg-red-50 dark:bg-red-950" : rightPick === i ? chosen : ""}`}
            >
              {rightPick === i ? "✔ " : ""}
              {m}
            </button>
          ))}
        </div>
      </div>
      {done && <p className="text-green-700 dark:text-green-400">✅ 全部配對完成{misses ? `（配錯 ${misses} 次）` : ""}</p>}
    </div>
  );
}

/** 字母重組：點字母拼出單字（英文）。 */
function ScrambleGame({ word, meaning, id, onDone }: { word: string; meaning: string; id: string; onDone: Done }) {
  const tiles = useMemo(() => letterTiles(word).map((c, i) => ({ c, i })), [word]);
  const [picked, setPicked] = useState<number[]>([]);
  const [result, setResult] = useState<boolean | null>(null);
  const built = picked.map((i) => tiles.find((t) => t.i === i)!.c).join("");

  function add(i: number) {
    const next = [...picked, i];
    setPicked(next);
    if (next.length === tiles.length) {
      const ok = sameAnswer(next.map((j) => tiles.find((t) => t.i === j)!.c).join(""), word);
      setResult(ok);
      onDone({ id, correct: ok });
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm">{meaning}</p>
      <p className="min-h-10 rounded-xl bg-black/5 p-2 font-mono text-lg tracking-widest dark:bg-white/10">{built || "　"}</p>
      <div className="flex flex-wrap gap-2">
        {tiles.map(({ c, i }) => (
          <button key={i} type="button" className={`${tile} font-mono ${picked.includes(i) ? "opacity-30" : ""}`} disabled={picked.includes(i) || result !== null} onClick={() => add(i)}>
            {c}
          </button>
        ))}
        {result === null && picked.length > 0 && (
          <button type="button" className="btn-ghost text-sm" onClick={() => setPicked(picked.slice(0, -1))}>
            ↩
          </button>
        )}
      </div>
      {result !== null && <p className={result ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>{result ? "✅ 對了" : `正確：${word}`}</p>}
    </div>
  );
}

/** 聽寫：播放後打字，八成以上算對。 */
function DictationGame({ sentence, language, id, onDone }: { sentence: string; language: Language; id: string; onDone: Done }) {
  const [typed, setTyped] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const spoken = joinChunks(sentenceChunks(sentence), language);

  function check() {
    const s = dictationScore(typed, spoken, language);
    setScore(s);
    onDone({ id, correct: s >= 0.8 });
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <SayButton onPlay={(rate) => speak(spoken, language, rate)} place="listen" label="播放聽寫" />
        <span className="self-center text-sm">按 🔊 聽，把聽到的打出來</span>
      </div>
      <input
        className="w-full rounded-lg border border-black/15 bg-transparent px-2 py-2 text-lg dark:border-white/20"
        value={typed}
        disabled={score !== null}
        onChange={(e) => setTyped(e.target.value)}
        placeholder="聽到什麼就打什麼"
        lang={language}
      />
      {score === null ? (
        <button type="button" className="btn text-sm" disabled={!typed.trim()} onClick={check}>
          檢查
        </button>
      ) : (
        <p className={score >= 0.8 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>
          {Math.round(score * 100)}%　正確：{spoken}
        </p>
      )}
    </div>
  );
}

/** 依加強項目挑適合的小遊戲：字彙→配對＋字母重組，文法／句型→拼句，聽力／發音→聽寫。 */
export function gameList(area: FocusArea, language: Language, sentences: string[], pairs: { term: string; meaning: string }[]) {
  const games: { id: string; title: string; kind: "order" | "match" | "scramble" | "dictation"; data: string | number }[] = [];
  if (area === "vocab") {
    if (pairs.length >= 3) games.push({ id: "match", title: "🔗 配對", kind: "match", data: 0 });
    if (language === "en")
      pairs
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => /^[a-z]{3,10}$/i.test(p.term))
        .slice(0, 3)
        .forEach(({ i }) => games.push({ id: `scramble-${i}`, title: "🔤 字母重組", kind: "scramble", data: i }));
  }
  if (area === "grammar" || area === "pattern")
    sentences.forEach((_, i) => games.push({ id: `order-${i}`, title: "🧩 拼句", kind: "order", data: i }));
  if ((area === "listening" || area === "pronunciation") && canSpeak())
    sentences.forEach((_, i) => games.push({ id: `dictation-${i}`, title: "✍️ 聽寫", kind: "dictation", data: i }));
  return games;
}

type Pair = { term: string; meaning: string; pos?: string; example?: string };

/**
 * 先分清楚：配對前，把意思很像的字（effect / affect）並排說明＋例句（點了會念、亮燈），
 * 再做一題挖空小練習，最後才進配對。不計分。
 */
function ContrastCard({ pairs, groups, language }: { pairs: Pair[]; groups: number[][]; language: Language }) {
  const [picked, setPicked] = useState<Record<string, string>>({});
  return (
    <div className="space-y-3 rounded-xl border border-amber-400/60 bg-amber-50/60 p-3 dark:bg-amber-900/20">
      <h3 className="font-semibold">🔍 先分清楚：這幾個字中文很像</h3>
      {groups.map((g, gi) => (
        <div key={gi} className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            {g.map((i) => (
              <div key={i} className="rounded-lg bg-white/70 p-2 dark:bg-black/20">
                <p className="text-lg font-semibold">
                  <SpeakText text={pairs[i].term} language={language} /> <span className="text-base font-normal">{withPos(pairs[i])}</span>
                </p>
                {pairs[i].example && <p className="text-sm"><SpeakText text={pairs[i].example!} language={language} place="read" /></p>}
              </div>
            ))}
          </div>
          {g.map((i) => {
            const blank = pairs[i].example ? blankOut(pairs[i].example!, pairs[i].term) : null;
            if (!blank) return null;
            const key = `${gi}-${i}`;
            const pick = picked[key];
            return (
              <div key={key} className="text-sm">
                <p>✏️ 填填看：{blank}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {g.map((k) => {
                    const t = pairs[k].term;
                    const state = pick === t ? (k === i ? "bg-green-500 text-white" : "bg-red-500 text-white") : "";
                    return (
                      <button key={k} type="button" className={`btn ${state}`} onClick={() => setPicked((p) => ({ ...p, [key]: t }))}>
                        {t}
                      </button>
                    );
                  })}
                </div>
                {pick && pick !== pairs[i].term && <p className="text-red-600">再看一次上面的詞性和例句 🙂</p>}
              </div>
            );
          })}
        </div>
      ))}
      {(() => {
        const names = [...new Set(groups.flat().map((i) => (pairs[i].pos ? posName(pairs[i].pos!) : "")).filter((n) => POS_TIPS[n]))];
        return names.length ? (
          <div className="space-y-1 text-sm">
            <p className="font-semibold">💡 什麼時候用哪一個？</p>
            {names.map((n) => <p key={n}>{POS_TIPS[n]}</p>)}
          </div>
        ) : null;
      })()}
    </div>
  );
}

export function Games({
  area,
  language,
  sentences,
  pairs,
  onResult,
}: {
  area: FocusArea;
  language: Language;
  sentences: string[];
  pairs: Pair[];
  onResult: Done;
}) {
  const games = useMemo(() => gameList(area, language, sentences, pairs), [area, language, sentences, pairs]);
  // 固定同一份陣列，避免父頁重繪時右邊意思又被洗牌。
  const matchPairs = useMemo(() => labelAmbiguousPairs(pairs.slice(0, 5)), [pairs]);
  const groups = useMemo(() => confusableGroups(pairs.slice(0, 5)), [pairs]);
  if (!games.length) return null;
  return (
    <section className="card space-y-5">
      <h2 className="font-semibold">🎮 小遊戲</h2>
      {games.map((g) => (
        <div key={g.id} className="space-y-1">
          <h3 className="text-sm text-black/60 dark:text-white/60">{g.title}</h3>
          {g.kind === "order" && <OrderGame sentence={sentences[g.data as number]} language={language} id={g.id} onDone={onResult} />}
          {g.kind === "dictation" && <DictationGame sentence={sentences[g.data as number]} language={language} id={g.id} onDone={onResult} />}
          {g.kind === "match" && groups.length > 0 && <ContrastCard pairs={pairs.slice(0, 5)} groups={groups} language={language} />}
          {g.kind === "match" && <MatchGame pairs={matchPairs} language={language} id={g.id} onDone={onResult} />}
          {g.kind === "scramble" && (
            <ScrambleGame word={pairs[g.data as number].term} meaning={pairs[g.data as number].meaning} id={g.id} onDone={onResult} />
          )}
        </div>
      ))}
    </section>
  );
}
