"use client";

import { SpeakText } from "@/components/SpeakText";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SessionDone } from "@/components/SessionDone";
import { useLearner } from "@/components/useLearner";
import { useAuth } from "@/components/useAuth";
import { today } from "@/lib/dates";
import { isManager } from "@/lib/types";
import {
  HOMEWORK_MAX_SECONDS,
  homeworkStatus,
  markDone,
  recentHomework,
  shrinkPhoto,
  startRecording,
  uploadHomework,
  type Homework,
  type HomeworkContent,
} from "@/lib/homework";
import { finishSession, PracticeTimer } from "@/lib/session";
import { ScoreSource } from "@/components/ScoreSource";
import { ShadowRecorder } from "@/components/ShadowRecorder";
import { canSpeak, speak, type Recording } from "@/lib/speech";
import { rateFor } from "@/lib/speech-speed";
import { PASS_SCORE, scoreShadow, type ShadowResult } from "@/lib/speech-score";
import { ScoreDot } from "@/components/ScoreDot";
import { bandLine, keepBest } from "@/lib/score-band";
import { supabaseConfigured } from "@/lib/supabase";
import type { Attempt } from "@/lib/types";
import { SayButton, SpeakControls } from "@/components/SpeakControls";

type Result = Awaited<ReturnType<typeof finishSession>>;

/** 孩子自己錄今天的學校／安親班英文作業：一個大按鈕，錄完送出就好。 */
function RecordHomework({
  learnerId,
  onDone,
}: {
  learnerId: string;
  onDone: (c: HomeworkContent, r: Result) => void;
}) {
  const { repo } = useLearner();
  const [phase, setPhase] = useState<
    "idle" | "recording" | "recorded" | "sending"
  >("idle");
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const stopRef = useRef<(() => Promise<Blob>) | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (tickRef.current) clearInterval(tickRef.current);
    },
    [],
  );
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : ""), [blob]);
  const photoUrl = useMemo(
    () => (photo ? URL.createObjectURL(photo) : ""),
    [photo],
  );

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      setPhoto(await shrinkPhoto(file));
    } catch {
      setError("這張照片讀不到，換一張試試");
    }
  }

  async function stop() {
    if (tickRef.current) clearInterval(tickRef.current);
    const b = await stopRef.current?.();
    stopRef.current = null;
    if (b) setBlob(b);
    setPhase("recorded");
  }

  async function start() {
    setError("");
    setBlob(null);
    setSeconds(0);
    try {
      const r = await startRecording(() => void stop());
      stopRef.current = r.stop;
      setPhase("recording");
      const began = Date.now();
      tickRef.current = setInterval(
        () => setSeconds(Math.floor((Date.now() - began) / 1000)),
        500,
      );
    } catch {
      setError("打不開麥克風，請大人幫忙在瀏覽器允許使用麥克風");
    }
  }

  async function send() {
    if (!blob) return;
    setPhase("sending");
    setError("");
    try {
      const content = await uploadHomework(learnerId, blob, photo);
      const result = await finishSession(
        repo,
        learnerId,
        [],
        [],
        Math.max(1, seconds / 60),
      );
      onDone(content, result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("recorded");
    }
  }

  const mmss = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <section className="card space-y-4 text-center">
      <p>1. 拍今天的課本或作業頁（可以不拍）</p>
      <label className="btn-ghost mx-auto inline-block cursor-pointer">
        📷 {photo ? "換一張" : "拍照或選照片"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => pickPhoto(e.target.files?.[0])}
        />
      </label>
      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt="課本照片"
          className="mx-auto max-h-48 rounded-lg"
        />
      )}
      <p>
        2. 戴上耳機，跟著今天的課程，把課本或作業大聲唸出來（1 到 3 分鐘）。
      </p>
      {phase === "idle" && (
        <button
          type="button"
          className="btn mx-auto block px-8 py-6 text-2xl"
          onClick={start}
        >
          🎤 開始錄音
        </button>
      )}
      {phase === "recording" && (
        <>
          <p className="text-3xl tabular-nums">
            🔴 {mmss(seconds)} / {mmss(HOMEWORK_MAX_SECONDS)}
          </p>
          <button
            type="button"
            className="btn mx-auto block px-8 py-6 text-2xl"
            onClick={stop}
          >
            ⏹ 唸完了
          </button>
        </>
      )}
      {(phase === "recorded" || phase === "sending") && blob && (
        <>
          <audio controls src={url} className="mx-auto" />
          <div className="flex justify-center gap-3">
            <button
              type="button"
              className="btn-ghost"
              onClick={start}
              disabled={phase === "sending"}
            >
              🔁 重錄
            </button>
            <button
              type="button"
              className="btn px-6 text-lg"
              onClick={send}
              disabled={phase === "sending"}
            >
              {phase === "sending" ? "AI 正在聽…" : "✅ 送出"}
            </button>
          </div>
        </>
      )}
      {error && <p className="text-red-700 dark:text-red-400">{error}</p>}
    </section>
  );
}

/** 錄完後看看 AI 整理出什麼。 */
function HomeworkSummary({ content }: { content: HomeworkContent }) {
  return (
    <section className="card space-y-2">
      <h2 className="font-semibold">AI 從你的作業整理出：</h2>
      <p>
        單字 {content.words.length} 個、片語 {content.phrases.length} 個、文法{" "}
        {content.grammar.length} 個，明天會排進練習。
      </p>
      {content.words.length > 0 && (
        <p className="text-sm">{content.words.map((w) => w.word).join("、")}</p>
      )}
      {content.issues.length > 0 && (
        <p className="text-sm">
          要注意的發音：
          {content.issues.map((i) => `${i.word}（${i.fix}）`).join("；")}
        </p>
      )}
    </section>
  );
}

/** 隔天：用作業內容練單字意思、看片語文法、跟讀句子。 */
function PracticeHomework({
  learnerId,
  hw,
}: {
  learnerId: string;
  hw: Homework;
}) {
  const { repo } = useLearner();
  const { words, phrases, grammar, sentences } = hw.content;
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [shadows, setShadows] = useState<Record<number, ShadowResult>>({});
  const [best, setBest] = useState<Record<number, number>>({});
  const [result, setResult] = useState<Result | null>(null);
  const timer = useRef(new PracticeTimer());

  // 每個單字給 4 個中文選項（從同一份作業的其他字取），順序固定避免重繪亂跳。
  const choices = useMemo(
    () =>
      words.map((w, i) => {
        const others = words.filter((_, j) => j !== i).map((o) => o.meaning);
        const picks = [...new Set(others)]
          .filter((m) => m !== w.meaning)
          .slice(0, 3);
        const all = [...picks, w.meaning];
        const shift = i % all.length;
        return [...all.slice(shift), ...all.slice(0, shift)];
      }),
    [words],
  );
  const quiz = words.length >= 2;
  const correct = words.filter((w, i) => answers[i] === w.meaning).length;

  async function shadow(i: number, rec: Recording) {
    timer.current.tick();
    const r = await scoreShadow(sentences[i], rec, "en");
    setShadows((s) => ({ ...s, [i]: r }));
    setBest((b) => keepBest(b, i, r.score));
  }

  async function finish() {
    timer.current.tick();
    const at = new Date().toISOString();
    const attempts: Attempt[] = quiz
      ? words.map((w, i) => ({
          learnerId,
          itemId: `hw-${hw.date}-${w.word}`,
          language: "en",
          skill: "vocab",
          correct: answers[i] === w.meaning,
          at,
        }))
      : [];
    await markDone(learnerId, hw.date, "practiced_at");
    setResult(
      await finishSession(
        repo,
        learnerId,
        [],
        attempts,
        Math.max(timer.current.minutes(), 3),
      ),
    );
  }

  if (result)
    return (
      <SessionDone
        learnerId={learnerId}
        correct={correct}
        total={quiz ? words.length : 0}
        result={result}
      />
    );

  return (
    <div className="space-y-4" onClick={() => timer.current.tick()}>
      {quiz && (
        <section className="card space-y-4">
          <h2 className="font-semibold">📖 單字：選出中文意思</h2>
          {words.map((w, i) => (
            <div key={i}>
              <p className="mb-2 text-lg font-medium">
                {w.word}
                {canSpeak() && (
                  <button
                    type="button"
                    className="btn-ghost ml-2 text-sm"
                    onClick={() => speak(w.word, "en", rateFor("cards"))}
                  >
                    🔊
                  </button>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {choices[i].map((c) => {
                  const picked = answers[i] === c;
                  const done = answers[i] !== undefined;
                  const state = done
                    ? c === w.meaning
                      ? "border-green-600 bg-green-50 dark:bg-green-950"
                      : picked
                        ? "border-red-600"
                        : "opacity-50"
                    : "";
                  return (
                    <button
                      key={c}
                      type="button"
                      disabled={done}
                      onClick={() => setAnswers({ ...answers, [i]: c })}
                      className={`rounded-xl border border-black/15 px-3 py-2 dark:border-white/20 ${state}`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {(phrases.length > 0 || grammar.length > 0) && (
        <section className="card space-y-3">
          <h2 className="font-semibold">🧩 片語和文法</h2>
          {phrases.map((p, i) => (
            <p key={`p${i}`}>
              <button
                type="button"
                className="btn-ghost mr-2 text-sm"
                onClick={() => speak(p.phrase, "en", rateFor("cards"))}
              >
                🔊
              </button>
              <span className="font-medium">{p.phrase}</span>：{p.meaning}
            </p>
          ))}
          {grammar.map((g, i) => (
            <div key={`g${i}`}>
              <p>{g.point}</p>
              <p className="text-sm text-black/70 dark:text-white/70">
                <SpeakText text={g.example} language="en" place="cards" />
              </p>
            </div>
          ))}
        </section>
      )}

      {sentences.length > 0 && (
        <section className="card space-y-3">
          <h2 className="font-semibold">🎤 跟讀</h2>
          {sentences.map((s, i) => {
            const r = shadows[i];
            return (
              <div key={i} className="space-y-1">
                <p className="flex items-start gap-2 text-lg">
                  <span className="mt-2">
                    <ScoreDot score={best[i]} />
                  </span>
                  <SpeakText text={s} language="en" place="shadow" />
                </p>
                <div className="flex items-center gap-2">
                  <SayButton onPlay={(rate) => speak(s, "en", rate)} place="shadow" label="聽示範" />
                  <ShadowRecorder iconOnly language="en" label={r ? "再唸一次" : "換我唸"} onRecorded={(rec) => shadow(i, rec)} />
                </div>
                {r && (
                  <p className="text-sm">
                    {bandLine(r.score, best[i])}
                    {r.score >= PASS_SCORE ? "" : "，再試一次"}
                    {r.issues.length > 0 &&
                      `：${r.issues.map((x) => `${x.word}（${x.fix}）`).join("；")}`}
                  </p>
                )}
                {r && (
                  <ScoreSource by={r.by} />
                )}
              </div>
            );
          })}
        </section>
      )}

      <button
        type="button"
        className="btn"
        disabled={quiz && Object.keys(answers).length < words.length}
        onClick={finish}
      >
        完成作業複習
      </button>
    </div>
  );
}

/** 從課程延伸：比課本深一點的新字，加上同主題、對準目標程度的短文。 */
function ExtendHomework({
  learnerId,
  hw,
}: {
  learnerId: string;
  hw: Homework;
}) {
  const { repo } = useLearner();
  const ext = hw.content.extension!;
  const [wordAnswers, setWordAnswers] = useState<Record<number, string>>({});
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<Result | null>(null);
  const timer = useRef(new PracticeTimer());

  const choices = useMemo(
    () =>
      ext.words.map((w, i) => {
        const others = [
          ...new Set(ext.words.filter((_, j) => j !== i).map((o) => o.meaning)),
        ].filter((m) => m !== w.meaning);
        const all = [...others.slice(0, 3), w.meaning];
        const shift = i % all.length;
        return [...all.slice(shift), ...all.slice(0, shift)];
      }),
    [ext.words],
  );
  const wordQuiz = ext.words.length >= 2;
  const total = (wordQuiz ? ext.words.length : 0) + ext.questions.length;
  const correct =
    (wordQuiz
      ? ext.words.filter((w, i) => wordAnswers[i] === w.meaning).length
      : 0) + ext.questions.filter((q, i) => answers[i] === q.answer).length;
  const allAnswered =
    (!wordQuiz || Object.keys(wordAnswers).length === ext.words.length) &&
    Object.keys(answers).length === ext.questions.length;

  async function finish() {
    timer.current.tick();
    const at = new Date().toISOString();
    const attempts: Attempt[] = [
      ...(wordQuiz
        ? ext.words.map((w, i) => ({
            learnerId,
            itemId: `hw-ext-${hw.date}-${w.word}`,
            language: "en" as const,
            skill: "vocab" as const,
            correct: wordAnswers[i] === w.meaning,
            at,
          }))
        : []),
      ...ext.questions.map((q, i) => ({
        learnerId,
        itemId: `hw-ext-${hw.date}-q${i}`,
        language: "en" as const,
        skill: "reading" as const,
        correct: answers[i] === q.answer,
        at,
      })),
    ];
    await markDone(learnerId, hw.date, "extended_at");
    setResult(
      await finishSession(
        repo,
        learnerId,
        [],
        attempts,
        Math.max(timer.current.minutes(), 5),
      ),
    );
  }

  if (result)
    return (
      <SessionDone
        learnerId={learnerId}
        correct={correct}
        total={total}
        result={result}
      />
    );

  const pick = (picked: boolean, done: boolean, right: boolean) =>
    done
      ? right
        ? "border-green-600 bg-green-50 dark:bg-green-950"
        : picked
          ? "border-red-600"
          : "opacity-50"
      : "";

  return (
    <div className="space-y-4" onClick={() => timer.current.tick()}>
      {wordQuiz && (
        <section className="card space-y-4">
          <h2 className="font-semibold">🌱 再多學幾個字</h2>
          {ext.words.map((w, i) => (
            <div key={i}>
              <p className="mb-2 text-lg font-medium">
                {w.word}
                {canSpeak() && (
                  <button
                    type="button"
                    className="btn-ghost ml-2 text-sm"
                    onClick={() => speak(w.word, "en", rateFor("cards"))}
                  >
                    🔊
                  </button>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {choices[i].map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={wordAnswers[i] !== undefined}
                    onClick={() => setWordAnswers({ ...wordAnswers, [i]: c })}
                    className={`rounded-xl border border-black/15 px-3 py-2 dark:border-white/20 ${pick(wordAnswers[i] === c, wordAnswers[i] !== undefined, c === w.meaning)}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <article className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{ext.title || "延伸短文"}</h2>
        </div>
        {canSpeak() && (
          <SpeakControls sequence place="read" onPlay={(rate) => speak(ext.text, "en", rate)} playLabel="朗讀全文" />
        )}
        <p className="text-lg leading-relaxed"><SpeakText text={ext.text} language="en" place="read" /></p>
      </article>

      {ext.questions.length > 0 && (
        <section className="card space-y-4">
          {ext.questions.map((q, i) => (
            <div key={i}>
              <p className="mb-2 font-medium">
                {i + 1}. {q.q}
              </p>
              <div className="flex flex-wrap gap-2">
                {q.choices.map((c, j) => (
                  <button
                    key={j}
                    type="button"
                    disabled={answers[i] !== undefined}
                    onClick={() => setAnswers({ ...answers, [i]: j })}
                    className={`rounded-xl border border-black/15 px-3 py-2 dark:border-white/20 ${pick(answers[i] === j, answers[i] !== undefined, j === q.answer)}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <button
        type="button"
        className="btn"
        disabled={!allAnswered}
        onClick={finish}
      >
        完成延伸練習
      </button>
    </div>
  );
}

function HomeworkInner() {
  const { learner } = useLearner();
  const auth = useAuth();
  const me = auth.status === "signed-in" ? auth.me : undefined;
  const params = useSearchParams();
  const mode = params.get("mode");
  const [list, setList] = useState<Homework[] | undefined>(undefined);
  const [sent, setSent] = useState<{
    content: HomeworkContent;
    result: Result;
  } | null>(null);

  useEffect(() => {
    if (!learner || !supabaseConfigured) return;
    recentHomework(learner.id)
      .then(setList)
      .catch(() => setList([]));
  }, [learner]);

  if (learner === null) return <p>找不到這位家人。</p>;
  if (!supabaseConfigured)
    return <p className="card">作業錄音要登入正式版才能用。</p>;
  if (!learner || list === undefined) return <p>載入中…</p>;

  const status = homeworkStatus(list);

  if (mode === "extend") {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">從課程延伸</h1>
        {status.toExtend ? (
          <ExtendHomework learnerId={learner.id} hw={status.toExtend} />
        ) : (
          <p className="card">沒有要延伸的作業，先錄今天的作業吧。</p>
        )}
      </div>
    );
  }

  if (mode === "practice") {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">作業複習</h1>
        {status.toPractice ? (
          <PracticeHomework learnerId={learner.id} hw={status.toPractice} />
        ) : (
          <p className="card">沒有要複習的作業，先錄今天的作業吧。</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">🎤 錄今天的英文作業</h1>
      {me && me.id !== learner.id && (
        <p className="card border-teal-600">
          {isManager(me.role)
            ? `👨‍👩‍👧 家長代傳：你正用自己的帳號幫「${learner.nickname}」拍照錄音，作業會存在${learner.nickname}名下，明天的練習也排給${learner.nickname}。`
            : "只有爸媽的帳號可以幫別人送作業。"}
        </p>
      )}
      {sent ? (
        <>
          <HomeworkSummary content={sent.content} />
          <SessionDone
            learnerId={learner.id}
            correct={0}
            total={0}
            result={sent.result}
          />
        </>
      ) : status.recordedToday ? (
        <div className="space-y-3">
          <p className="card">
            今天的作業已經錄好了 👍
            {(() => {
              const h = list.find((x) => x.date === today());
              return h?.uploadedBy && h.uploadedBy !== learner.id
                ? "（家長代傳）"
                : "";
            })()}
            想重錄的話再錄一次，會蓋掉舊的。
          </p>
          <HomeworkSummary
            content={list.find((h) => h.date === today())!.content}
          />
          <RecordHomework
            learnerId={learner.id}
            onDone={(content, result) => setSent({ content, result })}
          />
        </div>
      ) : (
        <RecordHomework
          learnerId={learner.id}
          onDone={(content, result) => setSent({ content, result })}
        />
      )}
      {!sent && (
        <Link
          href={`/learn/${learner.id}`}
          className="btn-ghost inline-block text-sm"
        >
          回到今天的清單
        </Link>
      )}
    </div>
  );
}

export default function HomeworkPage() {
  return (
    <Suspense fallback={<p>載入中…</p>}>
      <HomeworkInner />
    </Suspense>
  );
}
