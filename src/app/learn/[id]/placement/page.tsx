"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { KANA_ITEMS, VOCAB } from "@/content";
import { ChoiceQuestion } from "@/components/ChoiceQuestion";
import { useLearner } from "@/components/useLearner";
import { answerPlacement, placementResult, startPlacement, type PlacementState } from "@/lib/placement";
import { makeQuestion, shuffle, type Question } from "@/lib/quiz";
import { canSpeak, speak } from "@/lib/speech";
import { LANGUAGE_NAMES, LEVEL_LABELS, SKILLS, type Language, type Level, type SkillLevels, type StudyItem } from "@/lib/types";
import { parseLanguage } from "@/lib/types";

/** 每一級的題目：日語 L0 考五十音（看字選讀音），其餘考單字意思。 */
function questionFor(item: StudyItem, language: Language): Question {
  return item.skill === "reading" && item.level === 0
    ? makeQuestion(item, KANA_ITEMS, "reading")
    : makeQuestion(item, VOCAB[language], "meaning");
}

/** 分級測驗（試用版先用字彙題）：題目難度隨答對答錯上下調整。日語從五十音開始測。 */
function PlacementInner() {
  const { learner, repo } = useLearner();
  const params = useSearchParams();
  const language: Language = parseLanguage(params.get("lang"));
  const pool = useMemo(() => (language === "ja" ? [...KANA_ITEMS, ...VOCAB.ja] : VOCAB[language]), [language]);
  const levels = useMemo(() => [...new Set(pool.map((i) => i.level))].sort(), [pool]);
  const minLevel = levels[0] as Level;
  const maxLevel = levels[levels.length - 1] as Level;
  // 英文從 L2 開始測、最多 20 題，程度高的人才測得到上面幾級。
  const [state, setState] = useState<PlacementState>(() =>
    startPlacement((language === "en" ? Math.min(2, maxLevel) : minLevel) as Level, maxLevel, 20),
  );
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Level | null>(null);

  const question = useMemo(() => {
    const candidates = shuffle(pool.filter((i) => i.level === state.current && !used.has(i.id)));
    return candidates[0] ? questionFor(candidates[0], language) : null;
  }, [pool, state, used, language]);

  // 這一級的題目用完了，直接結束。
  useEffect(() => {
    if (!question && !state.done) setState((s) => ({ ...s, done: true }));
  }, [question, state.done]);

  useEffect(() => {
    if (!learner || !state.done || saved !== null) return;
    const result = Math.max(placementResult(state), minLevel) as Level;
    (async () => {
      const levelsAll = Object.fromEntries(SKILLS.map((s) => [s, result])) as SkillLevels;
      await repo.saveProgress(learner.id, { language, levels: levelsAll, placementDone: true });
      setSaved(result);
    })();
  }, [learner, repo, state, saved, language, minLevel]);

  if (learner === null) return <p>找不到這位家人。</p>;
  if (!learner) return <p>載入中…</p>;

  if (saved !== null) {
    return (
      <div className="card space-y-3 text-center">
        <p className="text-2xl">分級完成</p>
        <p>
          {LANGUAGE_NAMES[language]}起點：<strong>{LEVEL_LABELS[language][saved]}</strong>
        </p>
        {language === "ja" && (
          <p>{saved === 0 ? "先從五十音開始，每天 5 個新字。" : "五十音已經會了，直接從單字和短文開始。"}</p>
        )}
        <p className="text-sm text-black/60 dark:text-white/60">之後每 4 週會再小考一次，跟著實際表現調整。</p>
        <Link href={`/learn/${learner.id}`} className="btn">
          回到今天的清單
        </Link>
      </div>
    );
  }

  if (!question) return <p>計算結果中…</p>;

  const isKana = question.mode === "reading";
  const answer = (correct: boolean) => {
    setUsed(new Set(used).add(question.item.id));
    setState(answerPlacement(state, correct));
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{LANGUAGE_NAMES[language]}分級測驗</h1>
      <p className="text-sm text-black/60 dark:text-white/60">
        {language === "ja" && "從五十音開始，會的話會自動往單字（N5、N4）升級。"}
        {language === "es" && "從最簡單的打招呼開始，會的話會自動往 A1、A2 升級。完全沒學過的話，前幾題都按「不會」就好。"}
        不會的按「不會」就好，測驗中不公布答案，題目會自動調整難度。第 {state.asked + 1} 題，最多 {state.maxQuestions} 題。
      </p>
      <ChoiceQuestion
        key={`${question.item.id}-${state.asked}`}
        title={isKana ? "這個字怎麼唸？" : "選出意思"}
        prompt={
          <div>
            <p className={isKana ? "text-6xl font-medium" : "text-4xl font-medium"}>{question.item.prompt}</p>
            {language === "ja" && !isKana && question.item.extra && (
              <p className="mt-1 text-lg text-black/50 dark:text-white/50">{question.item.extra}</p>
            )}
          </div>
        }
        choices={question.choices}
        answerIndex={question.answerIndex}
        onPlay={!isKana && canSpeak() ? (rate) => speak(question.item.speak ?? question.item.prompt, language, rate) : undefined}
        place="cards"
        onDone={answer}
        mode="test"
      />
      <div className="text-center">
        <button type="button" className="btn-ghost text-sm" onClick={() => answer(false)}>
          不會，下一題
        </button>
      </div>
    </div>
  );
}

export default function PlacementPage() {
  return (
    <Suspense fallback={<p>載入中…</p>}>
      <PlacementInner />
    </Suspense>
  );
}
