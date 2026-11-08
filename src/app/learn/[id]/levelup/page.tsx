"use client";

import { SpeakText } from "@/components/SpeakText";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { READINGS, VOCAB } from "@/content";
import { presentQuestion, questionMode } from "@/content/readings";
import { ChoiceQuestion } from "@/components/ChoiceQuestion";
import { ShadowRecorder } from "@/components/ShadowRecorder";
import { SayButton, SpeedButton } from "@/components/SpeakControls";
import { useLearner } from "@/components/useLearner";
import { loadBankQuestions } from "@/lib/bank-quiz";
import { LEVELUP, levelUpStatus, quizAttemptId, quizPassed, type LevelUpStatus } from "@/lib/levelup";
import { makeQuestion, shuffle, type Question } from "@/lib/quiz";
import { badgeId, POINTS } from "@/lib/rewards";
import { scoreBand } from "@/lib/score-band";
import { canSpeak, speak, type Recording } from "@/lib/speech";
import { scoreShadow } from "@/lib/speech-score";
import { LANGUAGE_NAMES, LEVEL_LABELS, SKILL_NAMES, type Language, type Level, type Skill } from "@/lib/types";
import { parseLanguage } from "@/lib/types";

/** 升級小考的一題：選擇題（字彙、閱讀）或跟讀一句（口說）。 */
type QuizItem =
  | { kind: "choice"; id: string; title: string; prompt: React.ReactNode; choices: string[]; answer: number; play?: string }
  | { kind: "speak"; id: string; sentence: string };

function buildQuiz(language: Language, skill: Skill, to: Level): QuizItem[] {
  const n = LEVELUP.quizQuestions;
  if (skill === "vocab") {
    const pool = VOCAB[language].filter((i) => i.level === to);
    return shuffle(pool)
      .slice(0, n)
      .map((item) => {
        const q: Question = makeQuestion(item, VOCAB[language], "meaning");
        return {
          kind: "choice",
          id: item.id,
          title: "選出意思",
          prompt: (
            <div>
              <p className="text-4xl font-medium">{item.prompt}</p>
              {language === "ja" && item.extra && <p className="mt-1 text-lg text-black/50 dark:text-white/50">{item.extra}</p>}
            </div>
          ),
          choices: q.choices,
          answer: q.answerIndex,
          play: item.speak ?? item.prompt,
        };
      });
  }
  const readings = shuffle(READINGS.filter((r) => r.language === language && r.level === to));
  if (skill === "reading") {
    const mode = questionMode(to);
    const out: QuizItem[] = [];
    for (const r of readings) {
      r.questions.forEach((rq, i) => {
        const p = presentQuestion(rq, mode);
        out.push({
          kind: "choice",
          id: `${r.id}#${i}`,
          title: p.q,
          prompt: (
            <div className="space-y-2 text-left">
              <p className="font-semibold">{r.title}</p>
              <p className="whitespace-pre-line text-lg leading-relaxed">{r.text}</p>
            </div>
          ),
          choices: p.choices,
          answer: rq.answer,
        });
      });
      if (out.length >= n) break;
    }
    return out.slice(0, n);
  }
  // 口說：下一級短文裡的句子，一句一句跟讀。
  const sentences = readings.flatMap((r) =>
    r.text
      .split(/(?<=[.!?。！？])\s*/)
      .filter((s) => s.trim().length > 3)
      .map((s, i) => ({ kind: "speak" as const, id: `${r.id}#${i}`, sentence: s.trim() })),
  );
  return shuffle(sentences).slice(0, n);
}

function LevelUpInner() {
  const { learner, repo } = useLearner();
  const params = useSearchParams();
  const language: Language = parseLanguage(params.get("lang"));
  const skill = (["vocab", "grammar", "reading", "listening", "speaking"].includes(params.get("skill") ?? "") ? params.get("skill") : "vocab") as Skill;

  const [status, setStatus] = useState<LevelUpStatus | null>(null);
  const [quiz, setQuiz] = useState<QuizItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [speakNote, setSpeakNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState<{ passed: boolean; to: Level } | null>(null);

  useEffect(() => {
    if (!learner) return;
    (async () => {
      const p = await repo.getProgress(learner.id, language);
      const s = levelUpStatus(await repo.getAttempts(learner.id), language, skill, p.levels[skill]);
      setStatus(s);
      if (!s.eligible) return;
      const to = (s.level + 1) as Level;
      if (skill === "grammar" || skill === "listening") {
        const qs = await loadBankQuestions(language, skill, to, LEVELUP.quizQuestions);
        setQuiz(
          qs.map((q) => ({
            kind: "choice",
            id: `bank-${q.id}`,
            title: q.q,
            prompt: skill === "listening" && q.audio ? <p className="text-sm">🎧 按「再聽一次」聽題目</p> : undefined,
            choices: q.choices,
            answer: q.answer,
            play: skill === "listening" ? q.audio : undefined,
          })),
        );
      } else setQuiz(buildQuiz(language, skill, to));
    })();
  }, [learner, repo, language, skill]);

  const item = quiz?.[index];
  const total = quiz?.length ?? 0;

  async function finish(nCorrect: number) {
    if (!learner || !status) return;
    const to = (status.level + 1) as Level;
    const passed = quizPassed(nCorrect, total);
    await repo.addAttempts([
      { learnerId: learner.id, itemId: quizAttemptId(skill, to), language, skill, correct: passed, at: new Date().toISOString() },
    ]);
    if (passed) {
      const p = await repo.getProgress(learner.id, language);
      await repo.saveProgress(learner.id, { ...p, levels: { ...p.levels, [skill]: to } });
      const r = await repo.getRewards(learner.id);
      const badge = badgeId("level", `${LANGUAGE_NAMES[language]}${SKILL_NAMES[skill]} ${LEVEL_LABELS[language][to]}`);
      await repo.saveRewards({
        ...r,
        points: r.points + POINTS.levelUp,
        badges: r.badges.includes(badge) ? r.badges : [...r.badges, badge],
      });
    }
    setFinished({ passed, to });
  }

  function next(ok: boolean) {
    const n = correct + (ok ? 1 : 0);
    setCorrect(n);
    setSpeakNote("");
    if (index + 1 >= total) void finish(n);
    else setIndex(index + 1);
  }

  async function scored(rec: Recording) {
    if (!item || item.kind !== "speak") return;
    setBusy(true);
    setSpeakNote("");
    try {
      const s = await scoreShadow(item.sentence, rec, language);
      // 升級考只認 AI 老師的嚴格評分；瀏覽器評分不算，請再唸一次。
      if (s.by !== "gemini") {
        setSpeakNote(`AI 老師這次沒評到${s.note ? `（${s.note}）` : ""}，瀏覽器評分不算，請稍後再唸一次。`);
        return;
      }
      next(scoreBand(s.score) === "pass");
    } catch (e) {
      setSpeakNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (learner === null) return <p>找不到這位家人。</p>;
  if (!learner || !status) return <p>載入中…</p>;

  const back = (
    <Link href={`/learn/${learner.id}`} className="btn">
      回到今天的清單
    </Link>
  );

  if (!status.eligible) {
    return (
      <div className="card space-y-3 text-center">
        <p className="text-xl">還不能挑戰升級</p>
        <p>{status.note}</p>
        {back}
      </div>
    );
  }

  if (finished) {
    return (
      <div className="card space-y-3 text-center">
        {finished.passed ? (
          <>
            <p className="text-5xl">🎉🏅</p>
            <p className="text-2xl font-bold">升級成功！</p>
            <p>
              {LANGUAGE_NAMES[language]}
              {SKILL_NAMES[skill]}升到 <strong>{LEVEL_LABELS[language][finished.to]}</strong>，加 {POINTS.levelUp} 點！
            </p>
          </>
        ) : (
          <>
            <p className="text-2xl">差一點點</p>
            <p>
              答對 {correct} / {total}，要 {Math.round(LEVELUP.quizPass * 100)}% 以上才升級。再練 {LEVELUP.retryDays} 天之後可以再挑戰。
            </p>
          </>
        )}
        {back}
      </div>
    );
  }

  if (!quiz || total < LEVELUP.quizQuestions) {
    return (
      <div className="card space-y-3 text-center">
        <p>下一級的題目還不夠 {LEVELUP.quizQuestions} 題，請管理者先補題庫，或在後台手動調整級別。</p>
        {back}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">
        {LANGUAGE_NAMES[language]}
        {SKILL_NAMES[skill]}升級小考：{LEVEL_LABELS[language][status.level]} → {LEVEL_LABELS[language][(status.level + 1) as Level]}
      </h1>
      <p className="text-sm text-black/60 dark:text-white/60">
        第 {index + 1} / {total} 題，答對 {Math.round(LEVELUP.quizPass * 100)}% 以上就升級。測驗中不公布答案。
      </p>
      {item?.kind === "choice" && (
        <ChoiceQuestion
          key={`${item.id}-${index}`}
          language={language}
          title={item.title}
          prompt={item.prompt}
          choices={item.choices}
          answerIndex={item.answer}
          onPlay={item.play && canSpeak() ? (rate) => speak(item.play!, language, rate) : undefined}
          place={skill === "listening" ? "listen" : "cards"}
          onDone={next}
          mode="test"
        />
      )}
      {item?.kind === "speak" && (
        <div className="card space-y-3 text-center">
          <p className="text-2xl"><SpeakText text={item.sentence} language={language} place="shadow" /></p>
          <div className="flex items-center justify-center gap-2">
            <SayButton onPlay={(rate) => speak(item.sentence, language, rate)} place="shadow" label="聽示範" />
            <SpeedButton place="shadow" />
            <ShadowRecorder key={index} iconOnly language={language} label="按下開始唸" disabled={busy} onRecorded={(rec) => void scored(rec)} />
          </div>
          {busy && <p className="text-sm">AI 老師評分中…</p>}
          {speakNote && <p className="text-sm text-amber-700 dark:text-amber-400">{speakNote}</p>}
        </div>
      )}
    </div>
  );
}

export default function LevelUpPage() {
  return (
    <Suspense fallback={<p>載入中…</p>}>
      <LevelUpInner />
    </Suspense>
  );
}
