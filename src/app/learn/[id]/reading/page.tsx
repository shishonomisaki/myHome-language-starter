"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { READINGS } from "@/content";
import { SessionDone } from "@/components/SessionDone";
import { useLearner } from "@/components/useLearner";
import { finishSession, PracticeTimer } from "@/lib/session";
import { ScoreSource } from "@/components/ScoreSource";
import { ShadowRecorder } from "@/components/ShadowRecorder";
import { ScoreDot } from "@/components/ScoreDot";
import { Confetti } from "@/components/Confetti";
import { Highlighted } from "@/components/Highlighted";
import { bandLine, keepBest, loadBest, loadLast, passedCount, saveBest, saveLast, scoreBand } from "@/lib/score-band";
import { speakAttemptId } from "@/lib/levelup";
import { canSpeak, isSingleSentence, pauseSpeaking, resumeSpeaking, speak, speakState, splitWithOffsets, stopSpeaking, withTitle, type Recording, type SpeakProgress } from "@/lib/speech";
import { useSpeed } from "@/lib/speech-speed";
import { shuffle } from "@/lib/quiz";
import { scoreShadow, type ShadowResult } from "@/lib/speech-score";
import { ISSUE_LABEL } from "@/lib/pron-weak";
import { LANGUAGE_NAMES, type Language } from "@/lib/types";
import { parseLanguage } from "@/lib/types";
import { orderReadings, presentQuestion, questionMode, readingScore, type QuestionMode, type Reading } from "@/content/readings";
import { SpeakControls, SpeedButton, useSpeakState } from "@/components/SpeakControls";


/** 把短文切成一句一句（跟讀練習的單位）。 */
function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?。！？])\s*/).filter(Boolean);
}

/** 分級短文：先聽或先讀，回答理解題，再挑一句跟讀（瀏覽器語音辨識比對）。 */
function ReadingInner() {
  const { learner, repo } = useLearner();
  const params = useSearchParams();
  const language: Language = parseLanguage(params.get("lang"));
  /** ?topic=culture：只出文化短文（從台灣出發看歐美／日本）。 */
  const culture = params.get("topic") === "culture";
  const [fits, setFits] = useState<Reading[]>([]);
  const [reading, setReading] = useState<Reading | null | undefined>(undefined);
  /** 每題選項的顯示順序（打亂，避免答案位置被背起來）。 */
  const [orders, setOrders] = useState<number[][]>([]);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [mode, setMode] = useState<QuestionMode>("zh");
  const [answers, setAnswers] = useState<Record<number, number>>({});
  /** 先點了「看中文」的題目（答對只算半題）。 */
  const [hinted, setHinted] = useState<Record<number, boolean>>({});
  /** 交卷後答錯的題目，看了中文再選一次（只是練習，不另外記分）。 */
  const [retry, setRetry] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof finishSession>> | null>(null);
  /** 每句最近一次的評分結果；評分在背景跑，可以先去練下一句。 */
  const [results, setResults] = useState<Record<number, ShadowResult>>({});
  /** 還在等 AI 評分的句子（同一句可能連錄好幾次）。 */
  const [pending, setPending] = useState<Record<number, number>>({});
  const readingId = useRef("");
  /** 每句的最高分（存在這台裝置上，下次打開同一篇還看得到）。 */
  const [best, setBest] = useState<Record<number, number>>({});
  const [error, setError] = useState("");
  /** 朗讀全文、跟讀示範唸到哪。 */
  const [readAt, setReadAt] = useState<SpeakProgress | null>(null);
  const [demoAt, setDemoAt] = useState<SpeakProgress | null>(null);
  const timer = useRef(new PracticeTimer());
  /** 閱讀問答／跟讀練習兩個分頁，可以隨時自由切換，不用先交卷。 */
  const [tab, setTab] = useState<"read" | "shadow">("read");
  const [party, setParty] = useState(false);
  const bestRef = useRef(best);
  bestRef.current = best;
  const readSpeed = useSpeed("read");
  const shadowSpeed = useSpeed("shadow");
  const speakNow = useSpeakState();
  /** 念全文時連點的第幾下（1 暫停、2 繼續），沒在念全文就是 0。 */
  const taps = useRef(0);
  const lastOne = useRef(-1);
  /** 跟讀練習現在（或剛才）唸的是哪一句。 */
  const shadowPlaying = useRef(-1);
  useEffect(() => {
    if (speakNow === "idle") taps.current = 0;
  }, [speakNow]);
  /** 文化短文的思考題回答（不計分）。 */
  const [thoughts, setThoughts] = useState<Record<number, string>>({});
  const [savedThoughts, setSavedThoughts] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!learner) return;
    (async () => {
      const progress = await repo.getProgress(learner.id, language);
      const attempts = await repo.getAttempts(learner.id);
      const done = new Set(attempts.map((a) => a.itemId));
      const level = progress.levels.reading;
      setMode(questionMode(level));
      // 只出自己級數上下一級的短文，「換一篇」依序往下換。
      const ordered = orderReadings(
        READINGS.filter((r) => r.language === language && (!culture || r.topic === "culture")),
        level,
        done,
      );
      setFits(ordered);
      openReading(ordered[0] ?? null);
    })();
  }, [learner, repo, language, culture]);

  useEffect(() => {
    setBest(learner && reading ? loadBest(learner.id, reading.id) : {});
    setResults(learner && reading ? loadLast<ShadowResult>(learner.id, reading.id) : {});
  }, [learner, reading]);

  function openReading(r: Reading | null) {
    setReading(r);
    setOrders(r ? r.questions.map((q) => shuffle(q.choices.map((_, j) => j))) : []);
    setAnswers({});
    setHinted({});
    setRetry({});
    setThoughts({});
    setSavedThoughts({});
    setSubmitted(false);
    setResult(null);
    setResults({});
    setPending({});
    readingId.current = r?.id ?? "";
    setSentenceIndex(0);
    setTab("read");
    setParty(false);
    setError("");
    timer.current = new PracticeTimer();
  }

  function nextReading() {
    if (!reading || fits.length < 2) return;
    openReading(fits[(fits.indexOf(reading) + 1) % fits.length]);
  }

  if (learner === null) return <p>找不到這位家人。</p>;
  if (!learner || reading === undefined) return <p>載入中…</p>;
  if (!reading) return <p className="card">這個語言還沒有短文，等後台補上。</p>;

  const { spoken, textStart } = withTitle(reading.title, reading.text, language);
  const sentences = splitSentences(reading.text);
  const sentence = sentences[sentenceIndex] ?? sentences[0];
  const shadow = results[sentenceIndex] ?? null;
  const passed = passedCount(best);
  const allPassed = sentences.length > 0 && passed === sentences.length;

  const playAll = (rate = readSpeed.rate) => {
    taps.current = 0;
    void speak(spoken, language, rate, setReadAt);
  };
  const playOne = (start: number) => {
    taps.current = 0;
    lastOne.current = start;
    void speak(spoken, language, readSpeed.rate, setReadAt, textStart + start, true);
  };
  /**
   * 點標題或句子：
   * - 念全文時，第一下暫停、第二下從停住的地方繼續、第三下（點句子）才改成從頭只唸那一句；
   * - 單句唸到一半再點同一句是暫停／繼續；
   * - 其他時候：點標題從頭唸全文，點句子只唸那一句。
   */
  const tapSpeech = (target: { title: true } | { start: number }) => {
    timer.current.tick();
    const st = speakState();
    if (st !== "idle" && !isSingleSentence()) {
      if (st === "speaking") {
        if ("start" in target && taps.current === 2) return playOne(target.start);
        pauseSpeaking();
        taps.current = 1;
        return;
      }
      if (taps.current === 1) {
        resumeSpeaking();
        taps.current = 2;
        return;
      }
    }
    if ("title" in target) return playAll();
    if (st !== "idle" && isSingleSentence() && lastOne.current === target.start) {
      if (st === "speaking") pauseSpeaking();
      else resumeSpeaking();
      return;
    }
    playOne(target.start);
  };
  /** 跟讀練習：點一句就選中、直接唸（有亮燈）；唸的時候再點同一句＝暫停，暫停時再點＝繼續，唸完再點＝重唸。 */
  const pickShadow = (i: number) => {
    timer.current.tick();
    setSentenceIndex(i);
    const st = speakState();
    if (st !== "idle" && shadowPlaying.current === i) {
      if (st === "speaking") pauseSpeaking();
      else resumeSpeaking();
      return;
    }
    shadowPlaying.current = i;
    void speak(sentences[i], language, shadowSpeed.rate, setDemoAt);
  };
  const correct = readingScore(reading.questions, answers, hinted);

  async function submit() {
    if (!learner || !reading) return;
    timer.current.tick();
    setSubmitted(true);
    const at = new Date().toISOString();
    const r = await finishSession(
      repo,
      learner.id,
      [],
      reading.questions.map((q, i) => ({
        learnerId: learner.id,
        itemId: reading.id,
        language,
        skill: "reading" as const,
        // 看了中文才答對不算進升級，避免一直靠中文。
        correct: answers[i] === q.answer && !hinted[i],
        at,
      })),
      // 閱讀要花時間讀，計時以實際停留為準（最多 2 分鐘一段）。
      Math.max(timer.current.minutes(), reading.questions.length * 0.5),
    );
    setResult(r);
  }

  async function saveThought(i: number) {
    if (!learner || !reading) return;
    const answer = (thoughts[i] ?? "").trim();
    if (!answer) return;
    timer.current.tick();
    try {
      await repo.saveThought({ learnerId: learner.id, readingId: reading.id, index: i, answer, at: new Date().toISOString() });
      setSavedThoughts((s) => ({ ...s, [i]: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function scored(rec: Recording) {
    // 記下是哪一篇、哪一句：評分回來前使用者可能已經換到下一句或下一篇。
    const i = sentenceIndex;
    const id = reading?.id ?? "";
    const bump = (d: number) => setPending((p) => ({ ...p, [i]: Math.max((p[i] ?? 0) + d, 0) }));
    setError("");
    bump(1);
    try {
      const s = await scoreShadow(sentence, rec, language);
      // 升級只採計 AI 老師的評分，瀏覽器評分不算。
      if (learner && s.by === "gemini") {
        void repo
          .addAttempts([
            {
              learnerId: learner.id,
              itemId: speakAttemptId(id, i),
              language,
              skill: "speaking",
              correct: scoreBand(s.score) === "pass",
              at: new Date().toISOString(),
            },
          ])
          .catch(() => {});
      }
      if (readingId.current !== id) return;
      setResults((all) => {
        const next = { ...all, [i]: s };
        if (learner) saveLast(learner.id, id, next);
        return next;
      });
      const prev = bestRef.current;
      const nextBest = keepBest(prev, i, s.score);
      bestRef.current = nextBest;
      setBest(nextBest);
      if (learner) saveBest(learner.id, id, nextBest);
      if (sentences.length > 0 && passedCount(nextBest) === sentences.length && passedCount(prev) < sentences.length) setParty(true);
    } catch (e) {
      if (readingId.current === id) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (readingId.current === id) bump(-1);
    }
  }

  return (
    <div className="space-y-4">
      {party && <Confetti />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">
          {LANGUAGE_NAMES[language]}・{culture ? "文化短文" : "分級短文"}
        </h1>
        <a href={`?lang=${language}${culture ? "" : "&topic=culture"}`} className="btn-ghost text-sm">
          {culture ? "📖 回到所有短文" : language === "ja" ? "🗾 只看日本文化" : "🌍 只看文化短文"}
        </a>
      </div>

      <div className="card space-y-2 !p-3">
        <div className="flex items-center justify-between gap-2">
          {reading.topic === "culture" ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900 dark:text-amber-100">
              🌍 文化{reading.region ? `・${reading.region}` : ""}
            </span>
          ) : (
            <span />
          )}
          {fits.length > 1 && (
            <button type="button" className="btn-ghost !px-3 !py-1 text-sm" onClick={nextReading}>
              🔄 換一篇
            </button>
          )}
        </div>
        <h2 className="text-lg font-semibold">
          {canSpeak() ? (
            <button type="button" className="text-left" onClick={() => tapSpeech({ title: true })} title="點標題，從頭唸整篇">
              <Highlighted text={reading.title} progress={readAt} /> <span aria-hidden>🔊</span>
            </button>
          ) : (
            reading.title
          )}
        </h2>
      </div>

      <div role="tablist" aria-label="切換練習" className="grid grid-cols-2 gap-2">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "read"}
          onClick={() => {
            stopSpeaking();
            setTab("read");
          }}
          className={`rounded-xl border px-3 py-2 text-sm font-medium ${tab === "read" ? "border-teal-700 bg-teal-50 dark:bg-teal-950" : "border-black/15 dark:border-white/20"}`}
        >
          📖 閱讀問答{submitted ? " ✓" : ""}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "shadow"}
          onClick={() => {
            stopSpeaking();
            setTab("shadow");
          }}
          className={`rounded-xl border px-3 py-2 text-sm font-medium ${tab === "shadow" ? "border-teal-700 bg-teal-50 dark:bg-teal-950" : "border-black/15 dark:border-white/20"}`}
        >
          {allPassed ? <span className={party ? "pop" : ""}>🎉</span> : "🎤"} 跟讀練習 {passed}/{sentences.length}
        </button>
      </div>

      {tab === "read" && (
        <>
          <article className="card space-y-3" onClick={() => timer.current.tick()}>
            {canSpeak() && (
              <>
                <SpeakControls sequence place="read" onPlay={playAll} playLabel="從頭朗讀全文" />
                <p className="text-xs text-black/50 dark:text-white/50">點標題從頭唸整篇；點任一句，只唸那一句。</p>
              </>
            )}
            <p className={language === "ja" ? "text-xl leading-loose" : "text-lg leading-relaxed"}>
              {canSpeak() ? (
                splitWithOffsets(reading.text).map((p, i, all) => (
                  <span key={p.start}>
                    {reading.text.slice(i === 0 ? 0 : all[i - 1].start + all[i - 1].text.length, p.start)}
                    <span
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer rounded hover:bg-teal-50 dark:hover:bg-teal-950"
                      onClick={() => tapSpeech({ start: p.start })}
                    >
                      <Highlighted text={p.text} base={textStart + p.start} progress={readAt} />
                    </span>
                  </span>
                ))
              ) : (
                <Highlighted text={reading.text} base={textStart} progress={readAt} />
              )}
            </p>
          </article>

      <section className="card space-y-4">
        {mode !== "zh" && (
          <p className="text-xs text-black/50 dark:text-white/50">
            看不懂題目可以點「看中文」，但答對只算半題；答錯的題目交卷後會附上中文，讓你再選一次。
          </p>
        )}
        {reading.questions.map((raw, i) => {
          const wrong = submitted && answers[i] !== raw.answer;
          const q = presentQuestion(raw, mode, hinted[i] || wrong);
          // 答錯的題目先不公布答案，看了中文再選一次。
          const retrying = wrong && retry[i] === undefined;
          const canHint = mode !== "zh" && raw.qT && !hinted[i] && !submitted;
          return (
            <div key={i}>
              <p className="font-medium">
                {i + 1}. {q.q}
                {canHint && (
                  <button type="button" className="ml-2 text-xs font-normal underline" onClick={() => setHinted({ ...hinted, [i]: true })}>
                    看中文
                  </button>
                )}
                {hinted[i] && <span className="ml-2 text-xs font-normal text-black/50 dark:text-white/50">（看過中文，答對算半題）</span>}
              </p>
              {retrying && <p className="text-sm text-red-700 dark:text-red-400">答錯了，看看中文再選一次。</p>}
              {q.sub && <p className="text-sm text-black/50 dark:text-white/50">{q.sub}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                {(orders[i] ?? q.choices.map((_, j) => j)).map((j) => {
                  const c = q.choices[j];
                  const picked = answers[i] === j;
                  const state = retrying
                    ? picked
                      ? "border-red-600 opacity-50"
                      : ""
                    : submitted
                      ? j === raw.answer
                        ? "border-green-600 bg-green-50 dark:bg-green-950"
                        : picked || retry[i] === j
                          ? "border-red-600"
                          : "opacity-50"
                      : picked
                        ? "border-teal-700 bg-teal-50 dark:bg-teal-950"
                        : "";
                  return (
                    <button
                      key={j}
                      type="button"
                      disabled={submitted && (!retrying || picked)}
                      onClick={() => {
                        timer.current.tick();
                        if (retrying) setRetry({ ...retry, [i]: j });
                        else setAnswers({ ...answers, [i]: j });
                      }}
                      className={`rounded-xl border border-black/15 px-3 py-2 dark:border-white/20 ${state}`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {!submitted && (
          <button type="button" className="btn" disabled={Object.keys(answers).length < reading.questions.length} onClick={submit}>
            交卷
          </button>
        )}
      </section>


      {submitted && reading.think && reading.think.length > 0 && (
        <section className="card space-y-3">
          <h2 className="font-semibold">💭 想一想（沒有標準答案，不計分）</h2>
          <p className="text-xs text-black/60 dark:text-white/60">
            {mode === "target" ? "試著用外語寫兩三句，寫中文也可以。" : "用中文寫一句想法和理由就好。"}回答會存起來，爸媽可以和你聊聊。
          </p>
          {reading.think.map((t, i) => (
            <div key={i} className="space-y-1">
              <p className="font-medium">
                {i + 1}. {mode === "target" && t.qT ? t.qT : t.q}
              </p>
              {mode === "target" && t.qT && <p className="text-sm text-black/50 dark:text-white/50">{t.q}</p>}
              <textarea
                className="w-full rounded-xl border border-black/15 p-2 dark:border-white/20 dark:bg-stone-900"
                rows={3}
                maxLength={2000}
                value={thoughts[i] ?? ""}
                onChange={(e) => {
                  setThoughts({ ...thoughts, [i]: e.target.value });
                  setSavedThoughts({ ...savedThoughts, [i]: false });
                }}
              />
              <button type="button" className="btn-ghost text-sm" disabled={!(thoughts[i] ?? "").trim() || savedThoughts[i]} onClick={() => void saveThought(i)}>
                {savedThoughts[i] ? "✓ 已存" : "存下我的想法"}
              </button>
            </div>
          ))}
        </section>
      )}

        </>
      )}

      {tab === "shadow" && (
        <section className="card space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold">🎤 跟讀：點一句來練</h2>
              <p className="mt-1 text-xs text-black/60 dark:text-white/60">🟢 不錯喔　🟡 能更好　🔴 再試試</p>
            </div>
            {canSpeak() && <SpeedButton place="shadow" withName />}
          </div>
          <div className="flex flex-col gap-2">
            {sentences.map((t, i) => (
              <div key={i} className="space-y-2">
                <button
                  type="button"
                  onClick={() => pickShadow(i)}
                  className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left ${language === "ja" ? "text-xl leading-loose" : "text-lg leading-relaxed"} ${i === sentenceIndex ? "border-teal-700 bg-teal-50 dark:bg-teal-950" : "border-black/15 dark:border-white/20"}`}
                >
                  <span className="mt-2">{pending[i] ? <span title="AI 評分中">⏳</span> : <ScoreDot score={best[i]} />}</span>
                  <span>{i === sentenceIndex ? <Highlighted text={t} progress={demoAt} /> : t}</span>
                </button>
                {/* AI 講評直接放在被點的那一句下面，點到那句才出現。 */}
                {i === sentenceIndex && (
                  <div className="space-y-2 px-1">
                  {pending[sentenceIndex] ? <p className="text-xs text-black/60 dark:text-white/60">⏳ AI 評分中，可以先點下一句繼續練，結果回來會自動填到這一句。</p> : null}
                {shadow && (
                  <div className="space-y-2">
                    <p className="font-semibold">{bandLine(shadow.score, best[sentenceIndex])}</p>
                    <p className="text-sm text-black/60 dark:text-white/60">聽到：「{shadow.heard || "（沒聽到）"}」</p>
                    {shadow.tip && <p className="font-medium">{shadow.tip}</p>}
                    {shadow.issues.length > 0 && (
                      <ul className="space-y-2">
                        {shadow.issues.map((issue, i) => (
                          <li key={i} className="rounded-xl border border-black/10 p-2 dark:border-white/15">
                            <p>
                              <span className="font-semibold">{issue.word}</span>
                              <span className="ml-2 text-xs text-black/60 dark:text-white/60">{ISSUE_LABEL[issue.kind]}</span>
                            </p>
                            <p className="text-sm">{issue.fix}</p>
                            {issue.pair.length > 1 && (
                              <div className="mt-1 flex flex-wrap gap-2">
                                <span className="text-xs text-black/60 dark:text-white/60">聽聽看差在哪：</span>
                                {issue.pair.map((w) => (
                                  <button key={w} type="button" className="btn-ghost text-sm" onClick={() => speak(w, language, 0.6)}>
                                    🔊 {w}
                                  </button>
                                ))}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    <ScoreSource by={shadow.by} note={shadow.note} />
                  </div>
                )}
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* 🎤 固定在右下角，跟閱讀問答的朗讀圓鈕同一個位置，不用捲到最下面。 */}
          <div className="fixed bottom-4 dock-right z-40 rounded-full border border-teal-600/40 bg-white p-1 shadow-lg dark:border-teal-400/30 dark:bg-stone-900">
            <ShadowRecorder iconOnly language={language} label={shadow ? "再唸一次" : "換我唸"} onRecorded={(rec) => void scored(rec)} />
          </div>
          {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
        </section>
      )}

      {tab === "read" && submitted && result && <SessionDone learnerId={learner.id} correct={correct} total={reading.questions.length} result={result} />}
    </div>
  );
}

export default function ReadingPage() {
  return (
    <Suspense fallback={<p>載入中…</p>}>
      <ReadingInner />
    </Suspense>
  );
}
