// 跟讀評分：先問伺服器（Gemini 嚴格評分），不行就用瀏覽器辨識比對。

import { getSupabase, supabaseConfigured } from "./supabase";
import { PASS_SCORE, type SpeechIssue } from "./gemini";
import { isAndroid, markAiUnavailable, shadowingScore, type Recording } from "./speech";
import type { Language } from "./types";

export { PASS_SCORE };

export interface ShadowResult {
  heard: string;
  score: number;
  tip: string;
  issues: SpeechIssue[];
  /** 這次由誰評分。 */
  by: "gemini" | "browser";
  /** 改用瀏覽器評分的原因。 */
  note?: string;
}

/** 瀏覽器只聽得出字對不對，聽不出長短音、重音這些細節，所以分數最高只給到這裡。 */
export const BROWSER_MAX_SCORE = 0.9;

export async function scoreShadow(target: string, rec: Recording, language: Language): Promise<ShadowResult> {
  const browser = (note?: string): ShadowResult => ({
    heard: rec.heard,
    score: Math.min(shadowingScore(target, rec.heard, language), BROWSER_MAX_SCORE),
    tip: "",
    issues: [],
    by: "browser",
    // 手機只錄音不辨識，AI 不能用時就沒有文字可以比對；下一次改用手機的語音辨識。
    note: !rec.heard && rec.audio && isAndroid() ? `${note ?? ""}（這次只有錄音沒辦法比對，請再唸一次，會改用手機的語音辨識）` : note,
  });
  if (!supabaseConfigured || !rec.audio) return browser();
  try {
    const { data } = await getSupabase().auth.getSession();
    const res = await fetch("/api/speech", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify({ target, language, audio: rec.audio, mimeType: rec.mimeType }),
    });
    const json = await res.json();
    if (!res.ok || json.fallback) {
      markAiUnavailable();
      return browser(json.reason ?? json.error);
    }
    return { ...json, by: "gemini" };
  } catch {
    markAiUnavailable();
    return browser("AI 暫時沒回應，先用瀏覽器評分");
  }
}
