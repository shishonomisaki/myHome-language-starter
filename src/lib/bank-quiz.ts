// 文法、聽力的分級題目：從題庫（NotebookLM 產出、Claude 審過）抽已核准的選擇題。
// 作答 itemId 用 bank:<id>:L<級別>，升級計算才知道是哪一級。

import { getSupabase } from "./supabase";
import { shuffle } from "./quiz";
import type { Language, Level, Skill } from "./types";

export interface BankQuestion {
  id: number;
  level: Level;
  q: string;
  choices: string[];
  answer: number;
  explain: string;
  /** 聽力題：要朗讀的句子（先不顯示文字）。 */
  audio?: string;
}

/** 題庫 area 對應到哪個技能。 */
export function bankAreas(skill: Skill): string[] {
  if (skill === "grammar") return ["grammar", "pattern"];
  if (skill === "listening") return ["listening"];
  return [];
}

export function bankAttemptId(q: Pick<BankQuestion, "id" | "level">): string {
  return `bank:${q.id}:L${q.level}`;
}

export function bankAttemptLevel(itemId: string): Level | undefined {
  const m = /^bank:\d+:L([0-6])$/.exec(itemId);
  return m ? (Number(m[1]) as Level) : undefined;
}

export function toBankQuestion(row: { id: number; level: number; content: Record<string, unknown> }): BankQuestion | null {
  const c = row.content;
  const choices = (Array.isArray(c.choices) ? c.choices : []).map(String);
  const answer = Number(c.answer);
  if (!c.q || choices.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= choices.length) return null;
  return {
    id: row.id,
    level: row.level as Level,
    q: String(c.q),
    choices,
    answer,
    explain: String(c.explain ?? ""),
    audio: c.audio ? String(c.audio) : undefined,
  };
}

export async function loadBankQuestions(language: Language, skill: Skill, level: Level, count: number): Promise<BankQuestion[]> {
  const { data } = await getSupabase()
    .from("item_bank")
    .select("id, level, content")
    .eq("language", language)
    .eq("status", "approved")
    .eq("kind", "mcq")
    .eq("level", level)
    .in("area", bankAreas(skill))
    .limit(500);
  const qs = (data ?? []).map(toBankQuestion).filter((q): q is BankQuestion => q !== null);
  return shuffle(qs).slice(0, count);
}
