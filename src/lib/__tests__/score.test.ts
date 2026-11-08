import { describe, expect, it } from "vitest";
import { clampCorrect, firstAttempts } from "../score";

describe("答對數", () => {
  it("不會超過題數", () => {
    expect(clampCorrect(13, 12)).toBe(12);
    expect(clampCorrect(-1, 12)).toBe(0);
  });
  it("同一題重複送出只算第一次", () => {
    const a = [{ itemId: "x", correct: false }, { itemId: "x", correct: true }, { itemId: "y", correct: true }];
    expect(firstAttempts(a)).toEqual([a[0], a[2]]);
  });
});
