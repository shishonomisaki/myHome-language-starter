// 伺服器端專用：用今天輪到的 Gemini 金鑰做一件事（忙線就換下一把），並記下用量。
// 沒有金鑰、額度用完或出錯時回 fallback，呼叫端照原因處理。

import { QuotaError, type GeminiCall } from "./gemini";
import { serviceClient } from "./supabase-server";

export type AiResult<T> = { ok: true; value: T } | { ok: false; reason: string };

export const QUOTA_REASON = "今天的 AI 額度用完了";
export const BUSY_REASON = "AI 這一分鐘用太多次了，等一分鐘再唸就會恢復";

type Key = { key_id: number; api_key: string };

/** 今天能用的金鑰，輪到的那把排第一。資料庫還沒更新（沒有 ai_usable_keys）時只用輪到的那把。 */
async function usableKeys(db: ReturnType<typeof serviceClient>): Promise<Key[]> {
  const spread = await db.rpc("ai_usable_keys");
  const rows = spread.error ? (await db.rpc("ai_active_key")).data : spread.data;
  return (Array.isArray(rows) ? rows : []).filter((k): k is Key => !!k?.api_key);
}

/** 記下這次被跳過的模型（資料庫還沒有 ai_record_skip 時就略過）。 */
async function recordSkips(db: ReturnType<typeof serviceClient>, keyId: number, call: GeminiCall) {
  for (const s of call.skipped ?? []) {
    await db.rpc("ai_record_skip", { p_key: keyId, p_model: s.model, p_status: s.status, p_reason: s.reason });
  }
}

/**
 * 用輪到的金鑰做一件事，並記下用量。這把忙線（每分鐘次數滿）或今天額度用完，
 * 就在同一次呼叫裡換下一把，幾個人同時用時才不會全部卡在同一把。
 */
export async function withGeminiKey<T>(task: (call: GeminiCall) => Promise<T>): Promise<AiResult<T>> {
  const db = serviceClient();
  const keys = await usableKeys(db);
  if (!keys.length) return { ok: false, reason: QUOTA_REASON };
  let anyBusy = false;
  for (const key of keys) {
    const call: GeminiCall = { apiKey: key.api_key };
    try {
      const value = await task(call).finally(() => recordSkips(db, key.key_id, call));
      await db.rpc("ai_record_usage", { p_key: key.key_id, p_ok: true, p_model: call.model ?? null });
      return { ok: true, value };
    } catch (e) {
      // 只有每日額度用完才把金鑰標成今天不能用；每分鐘次數滿了等一下就好。
      const quota = e instanceof QuotaError && e.daily;
      const busy = e instanceof QuotaError && !e.daily;
      // 只記錯誤訊息（不含金鑰），方便在 Vercel 記錄查原因。
      console.error("gemini failed", key.key_id, e instanceof Error ? e.message : e);
      await db.rpc("ai_record_usage", { p_key: key.key_id, p_ok: false, p_quota: quota, p_model: call.model ?? null });
      anyBusy ||= busy;
      if (quota || busy) continue;
      // 錯誤代碼（不含金鑰）一起回給畫面，家人回報時才查得到原因。
      const code = e instanceof Error ? /Gemini (\d{3})/.exec(e.message)?.[1] : undefined;
      return { ok: false, reason: `AI 暫時沒回應${code ? `（錯誤 ${code}）` : ""}` };
    }
  }
  return { ok: false, reason: anyBusy ? BUSY_REASON : QUOTA_REASON };
}

/** 檢查上傳的錄音：base64、audio/* 格式、不超過上限。回傳錯誤訊息或 null。 */
export function audioError(audio: string, mimeType: string, maxBase64: number): string | null {
  if (!audio || !/^audio\/[\w.+-]+$/.test(mimeType)) return "缺少錄音";
  if (audio.length > maxBase64) return "錄音太長";
  return null;
}
