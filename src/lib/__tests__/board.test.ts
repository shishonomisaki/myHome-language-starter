import { describe, expect, it } from "vitest";
import { buildCards, taipeiDate, type BoardInput } from "../board";

const base = (id: string, over: Partial<BoardInput>): BoardInput => ({
  id, nickname: id, avatar: "🙂", dailyMinutes: 15, frozenDates: [], logs: [], attempts: [], doneToday: 0, ...over,
});

describe("board", () => {
  it("awards stars and progress, ignores tiny samples", () => {
    const cards = buildCards(
      [
        base("a", {
          logs: [{ date: "2026-11-01", minutes: 20 }, { date: "2026-10-31", minutes: 15 }],
          attempts: [{ date: "2026-11-01", total: 12, correct: 12 }, { date: "2026-10-20", total: 10, correct: 5 }],
        }),
        base("b", { logs: [{ date: "2026-11-01", minutes: 30 }], attempts: [{ date: "2026-11-01", total: 3, correct: 3 }] }),
      ],
      "2026-11-01",
    );
    const [a, b] = cards;
    expect(a.streak).toBe(2);
    expect(a.todayAccuracy).toBe(100);
    expect(a.improvement).toBe(50);
    expect(a.stars).toEqual(expect.arrayContaining(["🔥 最有恆心", "📈 進步最多", "🎯 最準", "✅ 今天達標"]));
    expect(b.todayAccuracy).toBeNull();
    expect(b.stars).toContain("⏱️ 最努力");
  });
  it("no stars when nobody practiced", () => {
    expect(buildCards([base("a", {})], "2026-11-01")[0].stars).toEqual([]);
  });
  it("uses Taipei date", () => {
    expect(taipeiDate(new Date("2026-10-31T17:00:00Z"))).toBe("2026-11-01");
  });
});
