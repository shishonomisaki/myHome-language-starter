// 瀏覽器端：讀自己一再唸不好的字（寫入只走伺服器的跟讀評分）。
import { dueWeak, type PronWeak } from "./pron-weak";
import { getSupabase, supabaseConfigured } from "./supabase";
import type { Language } from "./types";

export async function loadWeak(learnerId: string, language?: Language): Promise<PronWeak[]> {
  if (!supabaseConfigured) return [];
  let q = getSupabase().from("pron_weak").select("language, word, kind, fix, pair, misses, clean_streak, cleared_at").eq("learner_id", learnerId).is("cleared_at", null);
  if (language) q = q.eq("language", language);
  const { data, error } = await q.limit(500);
  if (error) return [];
  return dueWeak((data ?? []) as PronWeak[]);
}
