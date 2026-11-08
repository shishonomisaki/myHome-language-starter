// 題庫（NotebookLM 產出、管理者審過）：把題目組成一份強化單元。題目不夠時由呼叫端改請 Gemini 出題。

import type { FocusDrill, FocusQuestion } from "./gemini";
import { shuffle } from "./quiz";
import { labelAmbiguousPairs } from "./games";

export interface BankRow {
  id: number;
  kind: "mcq" | "sentence" | "pair";
  content: Record<string, unknown>;
}

/** 選擇題至少要這麼多題才夠一份（練習＋小測）。 */
export const MIN_BANK_MCQ = 8;

function toQuestion(c: Record<string, unknown>): FocusQuestion | null {
  const choices = (Array.isArray(c.choices) ? c.choices : []).map(String);
  const answer = Number(c.answer);
  if (!c.q || choices.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= choices.length) return null;
  return { q: String(c.q), choices, answer, explain: String(c.explain ?? ""), ...(c.audio ? { audio: String(c.audio) } : {}) };
}

export function drillFromBank(rows: BankRow[], title: string, rand: () => number = Math.random): FocusDrill | null {
  const mcq = shuffle(
    rows.filter((r) => r.kind === "mcq").map((r) => toQuestion(r.content)).filter((q): q is FocusQuestion => q !== null),
    rand,
  );
  if (mcq.length < MIN_BANK_MCQ) return null;
  const testCount = Math.min(5, mcq.length - 3);
  return {
    title,
    explain: "這次的題目來自家裡的題庫（NotebookLM 產出、媽媽審過）。先練習，再做小測。",
    passage: "",
    practice: mcq.slice(testCount, testCount + 6),
    test: mcq.slice(0, testCount),
    sentences: shuffle(rows.filter((r) => r.kind === "sentence").map((r) => String(r.content.text ?? "")).filter(Boolean), rand).slice(0, 3),
    pairs: labelAmbiguousPairs(shuffle(
      rows
        .filter((r) => r.kind === "pair")
        .map((r) => ({
          term: String(r.content.term ?? ""),
          meaning: String(r.content.meaning ?? ""),
          ...(r.content.pos ? { pos: String(r.content.pos) } : {}),
          ...(r.content.example ? { example: String(r.content.example) } : {}),
        }))
        .filter((p) => p.term && p.meaning),
      rand,
    ).slice(0, 5)),
  };
}

/** 聽力單元卻沒有任何可以唸的內容（舊版題庫轉出來時把每題的 audio 弄丟了）：這種要重出。 */
export function silentListening(drill: FocusDrill | null | undefined): boolean {
  if (!drill) return false;
  return !drill.passage && ![...(drill.practice ?? []), ...(drill.test ?? [])].some((q) => q.audio);
}
