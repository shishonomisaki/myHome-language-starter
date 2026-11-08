"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { EN_PHRASES, VOCAB } from "@/content";
import { Practice } from "@/components/Practice";
import { StudyCards } from "@/components/StudyCards";
import { useLearner } from "@/components/useLearner";
import { today } from "@/lib/dates";
import { makeQuestion, shuffle, spellQuestion, type Question } from "@/lib/quiz";
import { isDue } from "@/lib/srs";
import { LANGUAGE_NAMES, type CardState, type Language, type StudyItem } from "@/lib/types";
import { parseLanguage } from "@/lib/types";

const NEW_PER_SESSION = 8;
/** 複習時也練拼寫：看得懂不代表拼得出來。 */
const REVIEW_SPELL = 10;
/** 每次學新字順便帶幾個片語／口語（英文）。 */
const PHRASES_PER_SESSION = 2;

function VocabInner() {
  const { learner, repo } = useLearner();
  const params = useSearchParams();
  const language: Language = parseLanguage(params.get("lang"));
  const mode = params.get("mode") === "review" ? "review" : "new";
  // 排定的時間越長，新字越多（約每分鐘 1 個字，8～20 個）。
  const planned = Number(params.get("min")) || 0;
  const newCount = Math.min(20, Math.max(NEW_PER_SESSION, Math.round(planned)));
  const [data, setData] = useState<{ questions: Question[]; cards: CardState[]; fresh: StudyItem[] } | null>(null);
  const [studied, setStudied] = useState(false);

  useEffect(() => {
    if (!learner) return;
    (async () => {
      const day = today();
      const cards = await repo.getCards(learner.id);
      const progress = await repo.getProgress(learner.id, language);
      const words = VOCAB[language];
      const phrases = language === "en" ? EN_PHRASES : [];
      const pool = [...words, ...phrases];
      const known = new Map(cards.map((c) => [c.itemId, c]));
      let items;
      if (mode === "review") {
        items = shuffle(pool.filter((i) => known.has(i.id) && isDue(known.get(i.id)!, day))).slice(0, 30);
      } else {
        // 從目前級別開始找還沒學過的字；日語沒有 L0 單字（L0 是五十音）。
        const level = Math.max(progress.levels.vocab, language === "ja" ? 1 : 0);
        const fresh = (list: StudyItem[], n: number) =>
          list
            .filter((i) => !known.has(i.id) && i.level >= level)
            .sort((a, b) => a.level - b.level)
            .slice(0, n);
        // 片語從目前級別附近慢慢加：低一級的也可以補上，但不跳太高。
        const newPhrases = phrases
          .filter((i) => !known.has(i.id) && i.level <= level + 1)
          .sort((a, b) => b.level - a.level)
          .slice(0, PHRASES_PER_SESSION);
        items = [...fresh(words, newCount - newPhrases.length), ...newPhrases];
      }
      // 英文先認意思，再拼寫同一批字（拼錯也會讓那張卡提早複習）。
      const meaning = items.map((i) => makeQuestion(i, i.register ? phrases : words, "meaning"));
      const spellable = items.filter((i) => !i.register);
      const toSpell = mode === "review" ? shuffle(spellable).slice(0, REVIEW_SPELL) : shuffle(spellable);
      const spelling = language === "en" ? toSpell.map(spellQuestion) : [];
      setStudied(mode === "review" || !items.length);
      setData({ questions: [...meaning, ...spelling], cards, fresh: items });
    })();
  }, [learner, repo, language, mode, newCount]);

  if (learner === null) return <p>找不到這位家人。</p>;
  if (!learner || !data) return <p>載入中…</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">
        {LANGUAGE_NAMES[language]}・{mode === "review" ? "複習到期字卡" : "學新單字"}
      </h1>
      {studied ? (
        <Practice learner={learner} repo={repo} questions={data.questions} existingCards={data.cards} />
      ) : (
        <StudyCards learnerId={learner.id} items={data.fresh} onDone={() => setStudied(true)} />
      )}
    </div>
  );
}

export default function VocabPage() {
  return (
    <Suspense fallback={<p>載入中…</p>}>
      <VocabInner />
    </Suspense>
  );
}
