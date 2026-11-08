// 伺服器專用：跟讀評分後更新發音弱點表，出題時拿出來用。
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SpeechIssue } from "./gemini";
import { applyScore, dueWeak, normWord, type PronWeak } from "./pron-weak";
import type { Language } from "./types";

const COLS = "language, word, kind, fix, pair, misses, clean_streak, cleared_at";

/** 每次 AI 跟讀評分完呼叫；出錯不影響評分結果。 */
export async function recordPron(db: SupabaseClient, learnerId: string, language: Language, sentence: string, issues: SpeechIssue[]) {
  const { data } = await db.from("pron_weak").select(COLS).eq("learner_id", learnerId).eq("language", language).is("cleared_at", null).limit(500);
  const flagged = issues.map((i) => i.word);
  // 已經改好的字又被抓到：要接著原本的次數算，所以另外撈出來。
  const { data: cleared } = flagged.length
    ? await db.from("pron_weak").select(COLS).eq("learner_id", learnerId).eq("language", language).not("cleared_at", "is", null).in("word", flagged.map(normWord))
    : { data: [] };
  const changes = applyScore([...((data ?? []) as PronWeak[]), ...((cleared ?? []) as PronWeak[])], sentence, issues, language, new Date().toISOString());
  if (!changes.length) return;
  await db.from("pron_weak").upsert(changes.map((c) => ({ learner_id: learnerId, ...c.row })));
}

/** 這個人這個語言目前要加強的字。 */
export async function weakFor(db: SupabaseClient, learnerId: string, language: Language): Promise<PronWeak[]> {
  const { data } = await db.from("pron_weak").select(COLS).eq("learner_id", learnerId).eq("language", language).is("cleared_at", null).limit(500);
  return dueWeak((data ?? []) as PronWeak[]);
}

/** 有要加強的字的語言（排每日練習、半夜預先出題用）。 */
export async function weakLanguages(db: SupabaseClient, learnerId: string): Promise<Language[]> {
  const out: Language[] = [];
  for (const l of ["en", "ja"] as Language[]) if ((await weakFor(db, learnerId, l)).length) out.push(l);
  return out;
}
