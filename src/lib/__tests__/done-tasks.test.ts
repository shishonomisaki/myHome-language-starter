import { describe, expect, it } from "vitest";
import { taskKey, taskKeyFromUrl } from "../done-tasks";

describe("taskKeyFromUrl", () => {
  it("maps practice URLs back to plan task keys", () => {
    expect(taskKeyFromUrl("/learn/kid1/vocab", "?mode=review&lang=en")).toBe(taskKey("review", "en"));
    expect(taskKeyFromUrl("/learn/kid1/vocab", "?mode=new&lang=en")).toBe(taskKey("vocab", "en"));
    expect(taskKeyFromUrl("/learn/kid1/homework", "?mode=extend&lang=en")).toBe(taskKey("homework-extend", "en"));
    expect(taskKeyFromUrl("/learn/kid1/homework", "?lang=en")).toBe(taskKey("homework", "en"));
    expect(taskKeyFromUrl("/learn/kid2/focus", "?area=phonics&lang=en")).toBe(taskKey("focus", "en", "phonics"));
    expect(taskKeyFromUrl("/learn/kid2/kana", "?lang=ja")).toBe(taskKey("kana", "ja"));
    expect(taskKeyFromUrl("/learn/kid2/focus", "?area=homework&lang=en&min=10")).toBe(taskKey("homework-mix", "en"));
    expect(taskKeyFromUrl("/learn/kid2/kana", "")).toBeNull();
  });
});

import { pickHomework } from "../focus-server";

describe("pickHomework", () => {
  it("takes the latest past lesson plus older ones, oldest first, never today", () => {
    const list = ["2026-10-01", "2026-10-05", "2026-10-09", "2026-10-20", "2026-10-28", "2026-11-03"].map((date) => ({ date }));
    const picked = pickHomework(list, "2026-11-03");
    expect(picked.length).toBeGreaterThanOrEqual(2);
    expect(picked.at(-1)?.date).toBe("2026-10-28");
    expect(picked.some((p) => p.date === "2026-11-03")).toBe(false);
    expect([...picked].sort((a, b) => (a.date < b.date ? -1 : 1))).toEqual(picked);
  });
});
