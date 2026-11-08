"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChoiceQuestion } from "@/components/ChoiceQuestion";
import { SessionDone } from "@/components/SessionDone";
import { useLearner } from "@/components/useLearner";
import { bankAttemptId, loadBankQuestions, type BankQuestion } from "@/lib/bank-quiz";
import { finishSession, PracticeTimer } from "@/lib/session";
import { canSpeak, speak } from "@/lib/speech";
import { LANGUAGE_NAMES, LEVEL_LABELS, SKILL_NAMES, type Attempt, type Language, type Skill } from "@/lib/types";
import { parseLanguage } from "@/lib/types";

const PER_SESSION = 10;

/** 文法、聽力的分級練習：目前級別的題庫題。答對率會算進升級資格。 */
function BankInner() {
  const { learner, repo } = useLearner();
  const params = useSearchParams();
  const language: Language = parseLanguage(params.get("lang"));
  const skill: Skill = params.get("skill") === "listening" ? "listening" : "grammar";
  const [qs, setQs] = useState<BankQuestion[] | null>(null);
  const [level, setLevel] = useState(0);
  const [index, setIndex] = useState(0);
  const attempts = useRef<Attempt[]>([]);
  const timer = useRef(new PracticeTimer());
  const [result, setResult] = useState<Awaited<ReturnType<typeof finishSession>> | null>(null);

  useEffect(() => {
    if (!learner) return;
    (async () => {
      const p = await repo.getProgress(learner.id, language);
      setLevel(p.levels[skill]);
      setQs(await loadBankQuestions(language, skill, p.levels[skill], PER_SESSION));
    })();
  }, [learner, repo, language, skill]);

  if (learner === null) return <p>找不到這位家人。</p>;
  if (!learner || !qs) return <p>載入中…</p>;
  if (result) {
    const correct = attempts.current.filter((a) => a.correct).length;
    return <SessionDone learnerId={learner.id} correct={correct} total={attempts.current.length} result={result} />;
  }
  if (!qs.length) {
    return <p className="card">這一級的{SKILL_NAMES[skill]}題目還在準備中，先做其他練習吧。</p>;
  }

  const q = qs[index];
  const listen = skill === "listening" && q.audio;

  async function next() {
    if (index + 1 < qs!.length) {
      setIndex(index + 1);
      return;
    }
    setResult(await finishSession(repo, learner!.id, [], attempts.current, timer.current.minutes()));
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">
        {LANGUAGE_NAMES[language]}{SKILL_NAMES[skill]}練習・{LEVEL_LABELS[language][level as 0]}
      </h1>
      <p className="text-sm text-black/60 dark:text-white/60">
        第 {index + 1} / {qs.length} 題{listen ? "，先聽再選，聽不清楚可以按 🐢 放慢。" : ""}
      </p>
      <ChoiceQuestion
        key={q.id}
        language={language}
        title={q.q}
        prompt={undefined}
        choices={q.choices}
        answerIndex={q.answer}
        onPlay={listen && canSpeak() ? (rate) => speak(q.audio!, language, rate) : undefined}
        place="listen"
        onDone={(correct) => {
          timer.current.tick();
          attempts.current.push({ learnerId: learner.id, itemId: bankAttemptId(q), language, skill, correct, at: new Date().toISOString() });
          void next();
        }}
        hint={q.explain || undefined}
      />
    </div>
  );
}

export default function BankPracticePage() {
  return (
    <Suspense fallback={<p>載入中…</p>}>
      <BankInner />
    </Suspense>
  );
}
