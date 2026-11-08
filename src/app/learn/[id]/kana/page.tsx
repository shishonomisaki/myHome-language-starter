"use client";

import { useEffect, useState } from "react";
import { KANA_ITEMS, KANA_NEW_PER_DAY, KANA_REAL_WORDS } from "@/content";
import { Practice } from "@/components/Practice";
import { useLearner } from "@/components/useLearner";
import { today } from "@/lib/dates";
import { makeQuestion, shuffle, type Question } from "@/lib/quiz";
import { canSpeak, speak } from "@/lib/speech";
import { rateFor } from "@/lib/speech-speed";
import { isDue } from "@/lib/srs";
import type { CardState, StudyItem } from "@/lib/types";

/** 五十音：先看今天的新字與聯想，再用「看字選音」「聽音選字」混合練，學過的按間隔重複回來。 */
export default function KanaPage() {
  const { learner, repo } = useLearner();
  const [data, setData] = useState<{ fresh: StudyItem[]; questions: Question[]; cards: CardState[] } | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!learner) return;
    repo.getCards(learner.id).then((cards) => {
      const day = today();
      const known = new Map(cards.map((c) => [c.itemId, c]));
      const due = KANA_ITEMS.filter((k) => known.has(k.id) && isDue(known.get(k.id)!, day));
      const fresh = KANA_ITEMS.filter((k) => !known.has(k.id)).slice(0, KANA_NEW_PER_DAY);
      const items = [...fresh, ...shuffle(due).slice(0, 20)];
      const questions = shuffle(
        items.flatMap((item) => [makeQuestion(item, KANA_ITEMS, "reading"), makeQuestion(item, KANA_ITEMS, "sound")]),
      );
      setData({ fresh, questions, cards });
    });
  }, [learner, repo]);

  if (learner === null) return <p>找不到這位家人。</p>;
  if (!learner || !data) return <p>載入中…</p>;

  if (!started) {
    const learned = data.cards.filter((c) => c.itemId.startsWith("ja-kana-")).length;
    const words = KANA_REAL_WORDS.filter((w) =>
      [...w.word].every((ch) => ch === "ー" || data.cards.some((c) => KANA_ITEMS.find((k) => k.id === c.itemId)?.prompt === ch)),
    );
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">五十音</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          已經學過 {learned} / {KANA_ITEMS.length} 個。學過的字會在第 1、2、4、7、14…天再回來考，忘掉的隔天再練，這樣就不會學了又忘。
        </p>
        {data.fresh.length > 0 && (
          <div className="card space-y-3">
            <h2 className="font-semibold">今天的新字</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.fresh.map((k) => (
                <li key={k.id} className="flex items-center gap-3 rounded-xl border border-black/10 p-2 dark:border-white/10">
                  <button type="button" className="text-4xl" onClick={() => speak(k.speak ?? k.prompt, "ja", rateFor("cards"))} disabled={!canSpeak()}>
                    {k.prompt}
                  </button>
                  <span>
                    <span className="font-medium">{k.answer}</span>
                    {k.extra && <span className="block text-sm text-black/60 dark:text-white/60">{k.extra}</span>}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-black/50 dark:text-white/50">點字可以聽發音。</p>
          </div>
        )}
        {words.length > 0 && (
          <div className="card">
            <h2 className="mb-2 font-semibold">已經看得懂的真的字</h2>
            <p className="flex flex-wrap gap-3">
              {words.map((w) => (
                <button key={w.word} type="button" onClick={() => speak(w.word, "ja", rateFor("cards"))} className="btn-ghost">
                  {w.word}（{w.meaning}）
                </button>
              ))}
            </p>
          </div>
        )}
        <button type="button" className="btn" onClick={() => setStarted(true)} disabled={!data.questions.length}>
          {data.questions.length ? `開始練習（${data.questions.length} 題）` : "今天的五十音都練完了"}
        </button>
      </div>
    );
  }

  return <Practice learner={learner} repo={repo} questions={data.questions} existingCards={data.cards} />;
}
