// nlm 用量：把 Claude 記的帳換成「今天用了多少／上限」與每本筆記本的來源數。
import { taipeiDate } from "./board";

/** 大約的 Pro 上限（Google 沒公布可查的剩餘額度；被擋時會在記錄標 blocked，之後再校正）。 */
export const NLM_LIMITS = { query: 500, audio: 20, sourcesPerNotebook: 300, notebooks: 500 } as const;

export type Level = "ok" | "warn" | "full";
export function level(used: number, limit: number): Level {
  if (used >= limit) return "full";
  return used >= limit * 0.8 ? "warn" : "ok";
}

export interface NlmRow { at: string; kind: string; count: number; blocked: boolean }
export interface NlmNotebook { id: string; title: string; sources: number; checked_at: string }

export function summarizeNlm(rows: NlmRow[], notebooks: NlmNotebook[], now: Date) {
  const today = taipeiDate(now);
  const todayRows = rows.filter((r) => taipeiDate(new Date(r.at)) === today);
  const sum = (kinds: string[]) => todayRows.filter((r) => kinds.includes(r.kind)).reduce((s, r) => s + r.count, 0);
  const query = sum(["query", "quiz", "other"]);
  const audio = sum(["audio"]);
  return {
    today: {
      query: { used: query, level: level(query, NLM_LIMITS.query) },
      audio: { used: audio, level: level(audio, NLM_LIMITS.audio) },
      blocked: todayRows.some((r) => r.blocked),
    },
    notebooks: notebooks.map((n) => ({ ...n, level: level(n.sources, NLM_LIMITS.sourcesPerNotebook) })),
    notebookCount: { used: notebooks.length, level: level(notebooks.length, NLM_LIMITS.notebooks) },
  };
}
