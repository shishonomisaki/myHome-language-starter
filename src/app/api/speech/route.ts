// 跟讀評分：用今天輪到的 Gemini 金鑰。沒有金鑰、額度用完或出錯時回 fallback，頁面改用瀏覽器評分。

import { NextResponse } from "next/server";
import { audioError, withGeminiKey } from "@/lib/ai-server";
import { scoreSpeech } from "@/lib/gemini";
import { parseLanguage } from "@/lib/types";
import { recordPron } from "@/lib/pron-weak-server";
import { requireUser, serviceClient } from "@/lib/supabase-server";

/** 錄音上限約 1 MB（一句跟讀只要幾秒）。 */
const MAX_AUDIO_BASE64 = 1_400_000;

/** Gemini 聽錄音要幾秒到幾十秒。 */
export const maxDuration = 60;

export async function POST(req: Request) {
  const userId = await requireUser(req);
  if (!userId) return NextResponse.json({ error: "請先登入" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const target = String(body?.target ?? "").slice(0, 300);
  const language = parseLanguage(body?.language);
  const audio = String(body?.audio ?? "");
  const mimeType = String(body?.mimeType ?? "").split(";")[0];
  const bad = target ? audioError(audio, mimeType, MAX_AUDIO_BASE64) : "缺少句子";
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });

  const r = await withGeminiKey((key) => scoreSpeech(key, { base64: audio, mimeType }, target, language));
  if (!r.ok) return NextResponse.json({ fallback: true, reason: `${r.reason}，先用瀏覽器評分` });
  // 記下一再唸不好的字，之後排進「加強發音」複習（出錯不影響評分）。
  await recordPron(serviceClient(), userId, language, target, r.value.issues).catch(() => {});
  return NextResponse.json(r.value);
}
