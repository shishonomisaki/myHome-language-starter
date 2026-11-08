// 出選擇題：干擾選項優先從同一組（長得像的假名）或同級的字裡挑。

import type { StudyItem } from "./types";

export interface Question {
  item: StudyItem;
  /** "meaning"：看題面選中文；"sound"：聽音選字（選項是假名或單字）。 */
  mode: "meaning" | "sound" | "reading" | "spell";
  choices: string[];
  answerIndex: number;
}

export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function makeQuestion(
  item: StudyItem,
  pool: StudyItem[],
  mode: Question["mode"],
  rand: () => number = Math.random,
  count = 4,
): Question {
  const field = mode === "sound" ? "prompt" : "answer";
  const correct = item[field];
  const others = pool.filter((p) => p.id !== item.id && p[field] !== correct);
  const sameGroup = others.filter((p) => item.group && p.group === item.group);
  const sameLevel = others.filter((p) => p.level === item.level && !sameGroup.includes(p));
  const rest = others.filter((p) => !sameGroup.includes(p) && !sameLevel.includes(p));

  const distractors: string[] = [];
  for (const p of [...shuffle(sameGroup, rand), ...shuffle(sameLevel, rand), ...shuffle(rest, rand)]) {
    const v = p[field];
    if (!distractors.includes(v)) distractors.push(v);
    if (distractors.length >= count - 1) break;
  }
  const choices = shuffle([correct, ...distractors], rand);
  return { item, mode, choices, answerIndex: choices.indexOf(correct) };
}

/** 拼寫題：看中文、聽發音，打出英文單字（沒有選項）。 */
export function spellQuestion(item: StudyItem): Question {
  return { item, mode: "spell", choices: [], answerIndex: -1 };
}
