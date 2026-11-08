import type { ShadowResult } from "@/lib/speech-score";

/** 跟讀評分來源小字（全站共用）：AI 嚴格評分，或瀏覽器簡易評分。新增跟讀評分畫面時請一律放這個。 */
export function ScoreSource({ by, note }: { by: ShadowResult["by"]; note?: string }) {
  return (
    <p className="text-xs text-black/50 dark:text-white/50">
      {by === "gemini" ? "AI 嚴格評分：含糊的音一律不算對。" : `瀏覽器簡易評分（只看有沒有唸到字，不算進升級）。${note ?? ""}`}
    </p>
  );
}
