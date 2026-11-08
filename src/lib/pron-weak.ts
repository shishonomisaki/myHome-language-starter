// 發音弱點：跟讀 AI 老師一再抓到的字，整理成「加強發音」的複習（跟單字卡背不熟的邏輯一樣：
// 被抓到夠多次才排進來，連續唸對幾次就畢業）。

import type { SpeechIssue } from "./gemini";
import type { Language } from "./types";

/** 發音問題種類的中文名稱（跟讀講評和加強發音共用）。 */
export const ISSUE_LABEL: Record<SpeechIssue["kind"], string> = {
  vowel_length: "長短音",
  vowel_quality: "母音",
  stress: "重音",
  consonant: "子音",
  mora: "拍數（長音、促音）",
  missing: "漏唸",
  extra: "多唸",
  other: "其他",
};

/** 被抓到幾次才算「一再唸不好」（一兩次的不管）。 */
export const WEAK_MISSES = 3;
/** 被抓到這麼多次還沒改好，算頑固，整理給 nlm 出加強題。 */
export const STUBBORN_MISSES = 10;
/** 之後連續幾次唸到這個字都沒被抓到，就算改好了。 */
export const CLEAR_STREAK = 3;

export interface PronWeak {
  language: Language;
  word: string;
  kind: SpeechIssue["kind"];
  fix: string;
  pair: string[];
  misses: number;
  clean_streak: number;
  cleared_at: string | null;
}

/** 統一字的寫法：英文小寫、去掉前後標點；日文原樣（去標點）。 */
export function normWord(word: string): string {
  return word
    .trim()
    .replace(/^[\s"'“”‘’.,!?;:()「」『』、。！？…-]+|[\s"'“”‘’.,!?;:()「」『』、。！？…-]+$/g, "")
    .toLowerCase()
    .slice(0, 60);
}

/** 這句話裡有沒有唸到這個字（英文比整個字，日文比字串）。 */
export function sentenceHas(sentence: string, word: string, language: Language): boolean {
  if (!word) return false;
  const s = sentence.toLowerCase();
  if (language === "ja") return s.includes(word);
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z'])${esc}($|[^a-z'])`).test(s);
}

/**
 * 一次跟讀評分之後，算出要怎麼更新弱點表。
 * - 這次被抓到的字：misses +1、連續唸對歸零、改掉「已改好」。
 * - 表裡原本就有、這句有唸到、這次沒被抓到的字：連續唸對 +1，到 CLEAR_STREAK 就畢業。
 */
export function applyScore(
  existing: PronWeak[],
  sentence: string,
  issues: SpeechIssue[],
  language: Language,
  now: string,
): { row: PronWeak & { last_missed_at?: string }; isNew: boolean }[] {
  const byWord = new Map(existing.map((r) => [r.word, r]));
  const out = new Map<string, { row: PronWeak & { last_missed_at?: string }; isNew: boolean }>();
  for (const issue of issues) {
    const word = normWord(issue.word);
    if (!word || out.has(word)) continue;
    const old = byWord.get(word);
    out.set(word, {
      isNew: !old,
      row: {
        language,
        word,
        kind: issue.kind,
        fix: issue.fix || old?.fix || "",
        pair: issue.pair?.length ? issue.pair : (old?.pair ?? []),
        misses: (old?.misses ?? 0) + 1,
        clean_streak: 0,
        cleared_at: null,
        last_missed_at: now,
      },
    });
  }
  for (const old of existing) {
    if (out.has(old.word) || old.cleared_at || !sentenceHas(sentence, old.word, language)) continue;
    const streak = old.clean_streak + 1;
    out.set(old.word, { isNew: false, row: { ...old, clean_streak: streak, cleared_at: streak >= CLEAR_STREAK ? now : null } });
  }
  return [...out.values()];
}

/** 要排進複習的字：被抓到夠多次、還沒改好；最常錯的排前面。 */
export function dueWeak(rows: PronWeak[], min = WEAK_MISSES): PronWeak[] {
  return rows.filter((r) => !r.cleared_at && r.misses >= min).sort((a, b) => b.misses - a.misses);
}

/** 給出題 AI 的提示：哪些字、什麼問題、怎麼改。 */
export function weakForPrompt(rows: PronWeak[]): string[] {
  const top = habits(rows)[0];
  return [...(top ? [`HABIT: most common error type is ${top.kind} (${top.words} words)`] : []), ...rows.slice(0, 10).map((r) => `${r.word} (${r.kind}${r.fix ? `: ${r.fix}` : ""}${r.pair.length ? `; pair ${r.pair.join("/")}` : ""})`)];
}

/** 同一類錯誤合起來看：哪一種「習慣」最常犯（被提醒的總次數）。 */
export function habits(rows: PronWeak[]): { kind: SpeechIssue["kind"]; count: number; words: number }[] {
  const m = new Map<SpeechIssue["kind"], { count: number; words: number }>();
  for (const r of rows) {
    const h = m.get(r.kind) ?? { count: 0, words: 0 };
    m.set(r.kind, { count: h.count + r.misses, words: h.words + 1 });
  }
  return [...m.entries()].map(([kind, h]) => ({ kind, ...h })).filter((h) => h.words >= 2).sort((a, b) => b.count - a.count);
}

/** 每一類習慣的通用口訣（單字的改法之外，先建立這一類的感覺）。 */
export const HABIT_TIP: Record<SpeechIssue["kind"], string> = {
  vowel_length: "長音要拉夠、短音要乾脆：sheep 的 ee 拉長，ship 的 i 很短很鬆。",
  vowel_quality: "母音嘴型要到位：張嘴、嘴角、舌頭位置不同，音就不同。",
  stress: "重音那一拍唸得又大又長，其他拍輕輕帶過。",
  consonant: "子音要唸清楚，尤其字尾的 t、d、s，不要吞掉。",
  mora: "日文每一拍一樣長：長音拉滿兩拍，小っ停一拍。",
  missing: "字尾和小字不要漏，每個音都唸出來。",
  extra: "不要多加音，唸到字尾就停。",
  other: "放慢速度，一個音一個音唸清楚。",
};

/** 聽辨題：從對比字挑一個播放，請人選聽到哪個字。 */
export function listenQuiz(word: string, pair: string[], pick: number): { answer: string; choices: string[] } | null {
  const choices = [...new Set([word, ...pair])].slice(0, 4);
  if (choices.length < 2) return null;
  return { answer: choices[pick % choices.length], choices };
}
