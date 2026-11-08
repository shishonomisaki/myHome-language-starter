// 跟讀分數分三色：🟢 不錯喔（過關）、🟡 能更好、🔴 再試試。分數只在講評裡看得到，句子旁只放顏色。
import { PASS_SCORE } from "./gemini";

export const CLOSE_SCORE = 0.6;

export type ScoreBand = "pass" | "close" | "weak";

export function scoreBand(score: number): ScoreBand {
  if (score >= PASS_SCORE) return "pass";
  if (score >= CLOSE_SCORE) return "close";
  return "weak";
}

export const BAND_LABEL: Record<ScoreBand, string> = {
  pass: "不錯喔",
  close: "能更好",
  weak: "再試試",
};

export const BAND_EMOJI: Record<ScoreBand, string> = { pass: "🟢", close: "🟡", weak: "🔴" };

/** 講評開頭那一句：🟢 不錯喔・最高 92 分。 */
export function bandLine(score: number, best = score): string {
  const band = scoreBand(score);
  return `${BAND_EMOJI[band]} ${BAND_LABEL[band]}・本次最高 ${Math.round(best * 100)} 分`;
}

/** 每句只留最高分，讓重唸只會往上刷。 */
export function keepBest(best: Record<number, number>, i: number, score: number): Record<number, number> {
  return score > (best[i] ?? -1) ? { ...best, [i]: score } : best;
}

export function passedCount(best: Record<number, number>): number {
  return Object.values(best).filter((s) => scoreBand(s) === "pass").length;
}

const key = (learnerId: string, itemId: string) => `shadow-best:${learnerId}:${itemId}`;

export function loadBest(learnerId: string, itemId: string): Record<number, number> {
  try {
    const raw = localStorage.getItem(key(learnerId, itemId));
    return raw ? (JSON.parse(raw) as Record<number, number>) : {};
  } catch {
    return {};
  }
}

export function saveBest(learnerId: string, itemId: string, best: Record<number, number>) {
  try {
    localStorage.setItem(key(learnerId, itemId), JSON.stringify(best));
  } catch {
    // 私密模式或儲存被擋時，只是這次離開後不記得分數。
  }
}

const lastKey = (learnerId: string, itemId: string) => `shadow-last:${learnerId}:${itemId}`;

/** 每句最近一次的評分與講評，換句、重新整理後點回那一句還看得到。 */
export function loadLast<T>(learnerId: string, itemId: string): Record<number, T> {
  try {
    const raw = localStorage.getItem(lastKey(learnerId, itemId));
    return raw ? (JSON.parse(raw) as Record<number, T>) : {};
  } catch {
    return {};
  }
}

export function saveLast<T>(learnerId: string, itemId: string, last: Record<number, T>) {
  try {
    localStorage.setItem(lastKey(learnerId, itemId), JSON.stringify(last));
  } catch {
    // 存不了就只有這次看得到。
  }
}
