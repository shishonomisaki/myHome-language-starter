"use client";

import { SpeakText } from "@/components/SpeakText";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { gameList, Games, type GameResult } from "@/components/Games";
import { SessionDone } from "@/components/SessionDone";
import { useLearner } from "@/components/useLearner";
import { today } from "@/lib/dates";
import type { FocusDrill, FocusQuestion } from "@/lib/gemini";
import { silentListening } from "@/lib/item-bank";
import { prefetchFocus } from "@/lib/focus-prefetch";
import { finishSession, PracticeTimer } from "@/lib/session";
import { canSpeak, speak } from "@/lib/speech";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import { FOCUS_AREAS, FOCUS_NAMES, FOCUS_SKILL, LANGUAGE_NAMES, type Attempt, type FocusArea, type Language } from "@/lib/types";
import { parseLanguage } from "@/lib/types";
import { SayButton, SpeakControls } from "@/components/SpeakControls";
import { ShadowRecorder } from "@/components/ShadowRecorder";
import { WeakWords } from "@/components/WeakWords";
import type { PronWeak } from "@/lib/pron-weak";
import { loadWeak } from "@/lib/pron-weak-client";
import { scoreShadow, type ShadowResult } from "@/lib/speech-score";
import type { Recording } from "@/lib/speech";

type Result = Awaited<ReturnType<typeof finishSession>>;

/** 題目平常已先出好放在伺服器；同一天同一項也存在這台裝置，重新整理不用再拿。 */
async function loadDrill(learnerId: string, language: Language, area: FocusArea | "homework"): Promise<FocusDrill> {
  const key = `myhome-language:focus:${learnerId}:${today()}:${language}:${area}`;
  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      const drill: FocusDrill = JSON.parse(cached);
      if (!(area === "listening" && silentListening(drill))) return drill;
    }
  } catch {
    // 沒有暫存就重新出題。
  }
  const { data } = await getSupabase().auth.getSession();
  const res = await fetch("/api/focus", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify({ language, area }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "出題失敗");
  try {
    localStorage.setItem(key, JSON.stringify(json));
  } catch {
    // 存不進去也沒關係。
  }
  return json;
}

function Questions({
  list,
  answers,
  onAnswer,
  language,
}: {
  language: Language;
  list: FocusQuestion[];
  answers: Record<number, number>;
  onAnswer: (i: number, j: number) => void;
}) {
  // answers 只記第一次選的（計分用：第一次就對才算對）；之後的重試只在畫面上。
  const [wrong, setWrong] = useState<Record<number, number[]>>({});
  const [shown, setShown] = useState<Record<number, boolean>>({});
  const [lastPick, setLastPick] = useState<Record<number, number>>({});
  function choose(i: number, j: number, q: FocusQuestion) {
    if (answers[i] === undefined) onAnswer(i, j);
    if (j !== q.answer) setWrong((w) => ({ ...w, [i]: [...(w[i] ?? []), j] }));
  }
  return (
    <>
      {list.map((q, i) => {
        const tried = wrong[i] ?? [];
        const solved = lastPick[i] === q.answer;
        const done = solved || shown[i];
        return (
          <div key={i}>
            <div className="mb-2 flex items-center gap-2">
              {q.audio && canSpeak() && (
                <SayButton onPlay={(rate) => speak(q.audio!, language, rate)} place="listen" label="播放這題的聽力" />
              )}
              <p className="font-medium">
                {i + 1}. {q.q}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {q.choices.map((c, j) => {
                const cls =
                  done && j === q.answer
                    ? "border-green-600 bg-green-50 dark:bg-green-950"
                    : tried.includes(j)
                      ? "border-red-600 bg-red-50 opacity-60 dark:bg-red-950"
                      : done
                        ? "opacity-50"
                        : "";
                return (
                  <button
                    key={j}
                    type="button"
                    disabled={done || tried.includes(j)}
                    onClick={() => {
                      setLastPick((p) => ({ ...p, [i]: j }));
                      choose(i, j, q);
                    }}
                    className={`rounded-xl border border-black/15 px-3 py-2 dark:border-white/20 ${cls}`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            {!done && tried.length > 0 && (
              <p className="mt-1 flex items-center gap-3 text-sm text-red-700 dark:text-red-400">
                不對，再想想看。
                {tried.length >= 2 && (
                  <button type="button" className="underline" onClick={() => setShown((s) => ({ ...s, [i]: true }))}>
                    看答案
                  </button>
                )}
              </p>
            )}
            {done && (
              <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                {tried.length === 0 ? "答對了！" : shown[i] ? `正確答案：${q.choices[q.answer]}` : "這次答對了，之後會再複習。"}
                {q.explain && <SpeakText mixed className="block" text={q.explain} language={language} />}
              </p>
            )}
          </div>
        );
      })}
    </>
  );
}

function FocusInner() {
  const { learner, repo } = useLearner();
  const params = useSearchParams();
  const router = useRouter();
  const language: Language = parseLanguage(params.get("lang"));
  // area=homework：舊作業變化練習，練哪一項由題目自己帶（單字／句型／文法輪流）。
  const mix = params.get("area") === "homework";
  const [drill, setDrill] = useState<FocusDrill | null>(null);
  const area: FocusArea = mix
    ? (drill?.area ?? "vocab")
    : (FOCUS_AREAS as string[]).includes(params.get("area") ?? "")
      ? (params.get("area") as FocusArea)
      : "vocab";
  const [error, setError] = useState("");
  const [practice, setPractice] = useState<Record<number, number>>({});
  const [test, setTest] = useState<Record<number, number>>({});
  const [games, setGames] = useState<Record<string, GameResult>>({});
  const [result, setResult] = useState<Result | null>(null);
  const timer = useRef(new PracticeTimer());
  // 加強發音：一再唸不好的字，選一個用右下角 🎤 唸唸看。
  const [weak, setWeak] = useState<PronWeak[]>([]);
  const [pick, setPick] = useState(0);
  const [said, setSaid] = useState<Record<number, ShadowResult>>({});

  useEffect(() => {
    if (!learner || area !== "pronunciation") return;
    loadWeak(learner.id, language).then(setWeak).catch(() => {});
  }, [learner, language, area]);

  useEffect(() => {
    if (!learner || !supabaseConfigured) return;
    loadDrill(learner.id, language, mix ? "homework" : area)
      .then(setDrill)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    // 換項目只看網址；舊作業練習的 area 來自題目本身，不能讓它觸發重抓。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learner, language, mix ? "homework" : area]);

  if (learner === null) return <p>找不到這位家人。</p>;
  if (!learner) return <p>載入中…</p>;

  const heading = (
    <h1 className="text-xl font-semibold">
      {mix ? `${LANGUAGE_NAMES[language]}・🔁 舊作業變化練習` : `${LANGUAGE_NAMES[language]}・加強${FOCUS_NAMES[area]}`}
    </h1>
  );
  if (!supabaseConfigured || error) {
    return (
      <div className="space-y-4">
        {heading}
        <p className="card">{error || "這個練習要接上資料庫與 AI 才能用。"}</p>
        {area === "pronunciation" && (
          <button type="button" className="btn" onClick={() => router.push(`/learn/${learner.id}/reading?lang=${language}`)}>
            改做跟讀練發音
          </button>
        )}
        <Link className="btn-ghost" href={`/learn/${learner.id}`}>
          回今天的練習
        </Link>
      </div>
    );
  }
  if (!drill) return <p>題目載入中…</p>;

  const correct = drill.test.filter((q, i) => test[i] === q.answer).length;
  if (result) return <SessionDone learnerId={learner.id} correct={correct} total={drill.test.length} result={result} />;

  // 舊的暫存題目可能沒有小遊戲的欄位。
  const sentences = drill.sentences ?? [];
  const pairs = drill.pairs ?? [];
  const gameCount = gameList(area, language, sentences, pairs).length;
  const practiceDone = Object.keys(practice).length === drill.practice.length && Object.keys(games).length >= gameCount;
  const testDone = Object.keys(test).length === drill.test.length;

  async function sayWord(rec: Recording) {
    const i = pick;
    const w = weak[i];
    if (!w) return;
    timer.current.tick();
    const r = await scoreShadow(w.word, rec, language);
    setSaid((all) => ({ ...all, [i]: r }));
    // 伺服器評分時已更新連續唸對次數，這裡只更新畫面。
    if (r.by === "gemini") {
      const missed = r.issues.length > 0;
      setWeak((list) => list.map((x, j) => (j === i ? { ...x, misses: x.misses + (missed ? 1 : 0), clean_streak: missed ? 0 : x.clean_streak + 1 } : x)));
    }
  }

  async function finish() {
    if (!learner || !drill) return;
    timer.current.tick();
    const at = new Date().toISOString();
    const skill = FOCUS_SKILL[area];
    const day = today();
    const tag = mix ? `hwmix-${area}` : area;
    // 小測的作答用 focus-test- 開頭，後台用來算達成率。
    const attempts: Attempt[] = [
      ...drill.practice.map((q, i) => ({ learnerId: learner.id, itemId: `focus-practice-${tag}-${day}-${i}`, language, skill, correct: practice[i] === q.answer, at })),
      ...Object.values(games).map((g) => ({ learnerId: learner.id, itemId: `focus-game-${tag}-${day}-${g.id}`, language, skill, correct: g.correct, at })),
      ...drill.test.map((q, i) => ({ learnerId: learner.id, itemId: `focus-test-${tag}-${day}-${i}`, language, skill, correct: test[i] === q.answer, at })),
    ];
    // 用這次錯的題目，在背景替下一次先出好題。
    const mistakes = [...drill.practice.filter((q, i) => practice[i] !== q.answer), ...drill.test.filter((q, i) => test[i] !== q.answer)].map(
      (q) => `${q.q} → ${q.choices[q.answer]}`,
    );
    if (!mix) void prefetchFocus({ language, area, mistakes });
    setResult(await finishSession(repo, learner.id, [], attempts, Math.max(timer.current.minutes(), 5)));
  }

  // 聽力短文；萬一沒出到短文，就用拼句、聽寫的短句代替，至少有東西可以聽。
  const hasQAudio = [...drill.practice, ...drill.test].some((q) => q.audio);
  const listenText = drill.passage || (area === "listening" && !hasQAudio ? (drill.sentences ?? []).join(" ") : "");

  return (
    <div className="space-y-4" onClick={() => timer.current.tick()}>
      {heading}
      <WeakWords words={weak} language={language} selected={pick} onSelect={setPick} results={said} />
      <section className="card space-y-2">
        <h2 className="font-semibold">📌 {drill.title || "今天的重點"}</h2>
        <p className="whitespace-pre-line"><SpeakText mixed text={drill.explain} language={language} /></p>
        {drill.passage && area !== "listening" && <p className="whitespace-pre-line text-lg"><SpeakText text={drill.passage} language={language} place="read" /></p>}
        {area === "listening" &&
          (!listenText ? (
            hasQAudio ? (
              <p className="text-sm">每一題前面有一顆 🔊，先按它聽，再選答案（可以聽很多次）。</p>
            ) : (
              <p className="text-sm text-red-700 dark:text-red-400">這份聽力題目沒有聲音內容，請回上一頁再進來一次。</p>
            )
          ) : canSpeak() ? (
            <div className="flex items-center gap-3">
              <SayButton onPlay={(rate) => speak(listenText, language, rate)} place="listen" label="播放聽力" />
              <span className="text-sm">先按 🔊 聽短文（可以聽很多次），再回答下面的題目。</span>
            </div>
          ) : (
            <p className="text-sm text-red-700 dark:text-red-400">這台裝置的瀏覽器不支援朗讀，換 Chrome 或 Safari 試試。</p>
          ))}
        {(listenText || weak.length > 0) && canSpeak() && (
          <SpeakControls
            onPlay={(rate) => speak(listenText || weak[pick]?.word || "", language, rate)}
            place={area === "listening" ? "listen" : "general"}
            playLabel={area === "listening" ? "播放聽力" : "朗讀例句"}
            extra={
              weak[pick] ? (
                <ShadowRecorder iconOnly language={language} label={`唸唸看：${weak[pick].word}`} onRecorded={sayWord} />
              ) : undefined
            }
          />
        )}
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">✏️ 練習</h2>
        <Questions language={language} list={drill.practice} answers={practice} onAnswer={(i, j) => setPractice({ ...practice, [i]: j })} />
      </section>

      <Games area={area} language={language} sentences={sentences} pairs={pairs} onResult={(r) => setGames((g) => ({ ...g, [r.id]: r }))} />

      {practiceDone && (
        <section className="card space-y-4">
          <h2 className="font-semibold">✅ 小測</h2>
          <Questions language={language} list={drill.test} answers={test} onAnswer={(i, j) => setTest({ ...test, [i]: j })} />
        </section>
      )}

      <button type="button" className="btn" disabled={!practiceDone || !testDone} onClick={finish}>
        完成
      </button>
    </div>
  );
}

export default function FocusPage() {
  return (
    <Suspense fallback={<p>載入中…</p>}>
      <FocusInner />
    </Suspense>
  );
}
