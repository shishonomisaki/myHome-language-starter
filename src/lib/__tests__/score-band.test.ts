import { describe, expect, it } from "vitest";
import { keepBest, passedCount, scoreBand } from "../score-band";

describe("scoreBand", () => {
  it("splits scores into pass / close / weak", () => {
    expect(scoreBand(0.92)).toBe("pass");
    expect(scoreBand(0.85)).toBe("pass");
    expect(scoreBand(0.7)).toBe("close");
    expect(scoreBand(0.6)).toBe("close");
    expect(scoreBand(0.3)).toBe("weak");
  });
});

describe("keepBest", () => {
  it("only raises a sentence's score", () => {
    let best = keepBest({}, 0, 0.5);
    best = keepBest(best, 0, 0.4);
    expect(best[0]).toBe(0.5);
    best = keepBest(best, 0, 0.9);
    best = keepBest(best, 2, 0.88);
    expect(best).toEqual({ 0: 0.9, 2: 0.88 });
    expect(passedCount(best)).toBe(2);
  });
});
