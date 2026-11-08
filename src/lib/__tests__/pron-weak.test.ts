import { describe, expect, it } from "vitest";
import { applyScore, dueWeak, normWord, sentenceHas, type PronWeak } from "../pron-weak";
import { buildDailyPlan } from "../plan";

const row = (word: string, misses: number, clean = 0): PronWeak => ({ language: "en", word, kind: "vowel_length", fix: "", pair: [], misses, clean_streak: clean, cleared_at: null });
const issue = (word: string) => ({ word, kind: "vowel_length" as const, fix: "i 要唸長", pair: ["ship", "sheep"] });

describe("pron weak", () => {
  it("normalises words", () => {
    expect(normWord(" Sheep, ")).toBe("sheep");
    expect(normWord("「おばあさん」")).toBe("おばあさん");
  });
  it("matches whole English words only", () => {
    expect(sentenceHas("The sheep is white.", "sheep", "en")).toBe(true);
    expect(sentenceHas("Sheepish look", "sheep", "en")).toBe(false);
    expect(sentenceHas("おばあさんです", "おばあさん", "ja")).toBe(true);
  });
  it("counts a miss and resets the clean streak", () => {
    const [c] = applyScore([row("sheep", 2, 2)], "A sheep.", [issue("Sheep")], "en", "t");
    expect(c.row.misses).toBe(3);
    expect(c.row.clean_streak).toBe(0);
    expect(c.row.pair).toEqual(["ship", "sheep"]);
  });
  it("graduates after three clean readings", () => {
    const [c] = applyScore([row("sheep", 5, 2)], "A sheep.", [], "en", "t");
    expect(c.row.clean_streak).toBe(3);
    expect(c.row.cleared_at).toBe("t");
  });
  it("ignores words not in the sentence", () => {
    expect(applyScore([row("sheep", 5)], "A dog.", [], "en", "t")).toEqual([]);
  });
  it("only reviews words missed 3+ times, worst first", () => {
    expect(dueWeak([row("a", 1), row("b", 4), row("c", 12)]).map((r) => r.word)).toEqual(["c", "b"]);
  });
  it("adds a pronunciation unit when there are weak words", () => {
    const learner = { id: "x", nickname: "x", role: "learner" as const, isLearning: true, dailyMinutes: 30 as const, languages: { en: 1 }, aiEnabled: true, avatar: "🐯" };
    const perLanguage = { en: { placementDone: true, levels: { vocab: 1, grammar: 1, reading: 1, listening: 1, speaking: 1 } as never, dueReviews: 0, kanaMastered: true } };
    const tasks = buildDailyPlan({ learner, perLanguage, pronWeak: ["en"] });
    expect(tasks.some((t) => t.kind === "focus" && t.area === "pronunciation")).toBe(true);
  });
});

import { habits, listenQuiz } from "../pron-weak";
describe("habits and quiz", () => {
  it("groups by error type, needs 2+ words", () => {
    const rows = [row("a", 4), row("b", 5), { ...row("c", 9), kind: "stress" as const }];
    expect(habits(rows)).toEqual([{ kind: "vowel_length", count: 9, words: 2 }]);
  });
  it("builds a listening quiz from the pair", () => {
    expect(listenQuiz("ship", ["ship", "sheep"], 1)).toEqual({ answer: "sheep", choices: ["ship", "sheep"] });
    expect(listenQuiz("ship", [], 0)).toBeNull();
  });
});
