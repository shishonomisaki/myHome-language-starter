"use client";

import { useMemo, useRef, useState } from "react";
import { ChoiceQuestion } from "./ChoiceQuestion";
import { SessionDone } from "./SessionDone";
import { SpellQuestion } from "./SpellQuestion";
import { today } from "@/lib/dates";
import type { Question } from "@/lib/quiz";
import type { Repo } from "@/lib/repo";
import { finishSession, PracticeTimer } from "@/lib/session";
import { partsLabel } from "@/lib/morph";
import { canSpeak, speak } from "@/lib/speech";
import { rateFor } from "@/lib/speech-speed";
import { newCard, review } from "@/lib/srs";
import type { Attempt, CardState, Learner } from "@/lib/types";

const TITLES: Record<Question["mode"], string> = {
  meaning: "選出意思",
  sound: "聽聲音，選出是哪一個",
  reading: "這個字怎麼唸？",
  spell: "拼出這個字",
};

/** 一輪選擇題練習：每題更新間隔重複卡片，做完記分鐘與獎勵。 */
export function Practice({
  learner,
  repo,
  questions,
  existingCards,
}: {
  learner: Learner;
  repo: Repo;
  questions: Question[];
  existingCards: CardState[];
}) {
  const timer = useRef(new PracticeTimer());
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const cards = useRef(new Map(existingCards.map((c) => [c.itemId, c])));
  const attempts = useRef<Attempt[]>([]);
  const [result, setResult] = useState<Awaited<ReturnType<typeof finishSession>> | null>(null);
  const [finished, setFinished] = useState(false);
  const handled = useRef(new Set<number>());
  const day = useMemo(() => today(), []);

  if (finished) return <SessionDone learnerId={learner.id} correct={correctCount} total={questions.length} result={result} />;
  const q = questions[index];
  if (!q) return <p className="card">今天這部分沒有要練的了，回清單看看別的吧。</p>;

  const say = (rate: number) => speak(q.item.speak ?? q.item.prompt, q.item.language, rate);
  // 聽音選字是聽力，語速自己記；其他是單字，預設慢速。
  const place = q.mode === "sound" ? "listen" : "cards";
  const showPrompt = q.mode !== "sound";

  async function onDone(correct: boolean) {
    // 同一題只記一次（防連點），答對數直接由作答紀錄算，不會超過題數。
    if (handled.current.has(index)) return;
    handled.current.add(index);
    timer.current.tick();
    const id = q.item.id;
    const card = cards.current.get(id) ?? newCard(learner.id, id, day);
    cards.current.set(id, review(card, correct, day));
    attempts.current.push({
      learnerId: learner.id,
      itemId: q.mode === "spell" ? `${id}-spell` : id,
      language: q.item.language,
      skill: q.item.skill,
      correct,
      at: new Date().toISOString(),
    });
    if (correct) setCorrectCount((n) => n + 1);
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      if (questions[index + 1].mode === "sound") {
        const next = questions[index + 1].item;
        speak(next.speak ?? next.prompt, next.language, rateFor("listen"));
      }
      return;
    }
    const touched = new Set(attempts.current.map((a) => a.itemId.replace(/-spell$/, "")));
    const r = await finishSession(
      repo,
      learner.id,
      [...cards.current.values()].filter((c) => touched.has(c.itemId)),
      attempts.current,
      timer.current.minutes(),
    );
    setResult(r);
    setFinished(true);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-black/50 dark:text-white/50">
        第 {index + 1} / {questions.length} 題
      </p>
      {q.mode === "spell" ? (
        <SpellQuestion
          key={`${q.item.id}-${index}`}
          word={q.item.prompt}
          meaning={q.item.answer}
          parts={q.item.parts}
          onPlay={canSpeak() ? say : undefined}
          place={place}
          onDone={onDone}
        />
      ) : (
      <ChoiceQuestion
        key={`${q.item.id}-${index}`}
        language={q.item.language}
        title={TITLES[q.mode]}
        prompt={
          showPrompt ? (
            <div>
              <p className="text-5xl font-medium">{q.item.prompt}</p>
              {q.item.language === "ja" && q.item.skill === "vocab" && q.item.extra && (
                <p className="mt-1 text-lg text-black/50 dark:text-white/50">{q.item.extra}</p>
              )}
            </div>
          ) : (
            <p className="text-5xl">🔊</p>
          )
        }
        hint={q.item.skill === "reading" ? q.item.extra : q.item.parts && q.mode === "meaning" ? partsLabel(q.item.parts) : undefined}
        choices={q.choices}
        answerIndex={q.answerIndex}
        onPlay={canSpeak() ? say : undefined}
        place={place}
        onDone={onDone}
        choiceClassName={q.mode === "sound" ? "text-3xl" : "text-lg"}
      />
      )}
    </div>
  );
}
