import { describe, expect, it } from "vitest";
import { READINGS, VOCAB } from "@/content";
import { levelUpStatus, quizAttemptId, quizPassed, speakAttemptId, weakSkills } from "../levelup";
import { ZERO_LEVELS, type Attempt } from "../types";

const r1 = READINGS.find((r) => r.language === "en" && r.level === 1)!.id;
const now = new Date("2026-11-20T12:00:00Z");
const l1 = VOCAB.en.filter((i) => i.level === 1);
function vocab(n: number, days: number, wrong = 0): Attempt[] {
  return Array.from({ length: n }, (_, i) => ({
    learnerId: "x",
    itemId: l1[i % l1.length].id,
    language: "en" as const,
    skill: "vocab" as const,
    correct: i >= wrong,
    at: new Date(now.getTime() - (i % days) * 86_400_000 - 3600_000).toISOString(),
  }));
}

describe("levelup", () => {
  it("needs 40 answers over 5 days above 95%", () => {
    expect(levelUpStatus(vocab(40, 5), "en", "vocab", 1, now).eligible).toBe(true);
    expect(levelUpStatus(vocab(39, 5), "en", "vocab", 1, now).eligible).toBe(false);
    expect(levelUpStatus(vocab(40, 4), "en", "vocab", 1, now).eligible).toBe(false);
    expect(levelUpStatus(vocab(40, 5, 2), "en", "vocab", 1, now).eligible).toBe(false); // 95% 不夠，要超過
    expect(levelUpStatus(vocab(60, 5, 2), "en", "vocab", 1, now).eligible).toBe(true);
  });

  it("ignores answers from lower levels", () => {
    expect(levelUpStatus(vocab(40, 5), "en", "vocab", 2, now).eligible).toBe(false);
  });

  it("waits 3 days after a failed quiz", () => {
    const fail: Attempt = { learnerId: "x", itemId: quizAttemptId("vocab", 2), language: "en", skill: "vocab", correct: false, at: new Date(now.getTime() - 86_400_000).toISOString() };
    const s = levelUpStatus([...vocab(40, 5), fail], "en", "vocab", 1, now);
    expect(s.eligible).toBe(false);
    expect(s.retryAfter).toBeDefined();
  });

  it("counts only AI-scored speaking, 8 of last 10 green", () => {
    const sp = (green: number): Attempt[] =>
      Array.from({ length: 10 }, (_, i) => ({ learnerId: "x", itemId: speakAttemptId(r1, i), language: "en", skill: "speaking", correct: i < green, at: now.toISOString() }));
    expect(levelUpStatus(sp(8), "en", "speaking", 1, now).eligible).toBe(true);
    expect(levelUpStatus(sp(7), "en", "speaking", 1, now).eligible).toBe(false);
  });

  it("quiz needs 15 questions at 90%", () => {
    expect(quizPassed(14, 15)).toBe(true);
    expect(quizPassed(13, 15)).toBe(false);
    expect(quizPassed(9, 10)).toBe(false);
  });

  it("flags weak skills below 50%", () => {
    expect(weakSkills(vocab(20, 5, 12), "en", { ...ZERO_LEVELS, vocab: 1 }, now)).toEqual(["vocab"]);
  });
});

describe("bank attempts", () => {
  it("reads the level from bank item ids", async () => {
    const { attemptLevel } = await import("../levelup");
    expect(attemptLevel({ learnerId: "x", itemId: "bank:12:L4", language: "en", skill: "grammar", correct: true, at: "" })).toBe(4);
  });
});
