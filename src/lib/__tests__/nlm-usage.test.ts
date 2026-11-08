import { describe, expect, it } from "vitest";
import { level, summarizeNlm } from "../nlm-usage";

describe("nlm usage", () => {
  it("turns yellow at 80% and red when full", () => {
    expect(level(399, 500)).toBe("ok");
    expect(level(400, 500)).toBe("warn");
    expect(level(500, 500)).toBe("full");
  });

  it("counts only today's (Taipei) rows", () => {
    const now = new Date("2026-11-02T03:00:00Z"); // 台灣 11:00
    const s = summarizeNlm(
      [
        { at: "2026-11-01T17:00:00Z", kind: "audio", count: 2, blocked: false }, // 台灣 11/2 01:00
        { at: "2026-11-01T15:00:00Z", kind: "audio", count: 5, blocked: true }, // 台灣 11/1 23:00
        { at: "2026-11-02T01:00:00Z", kind: "quiz", count: 3, blocked: false },
      ],
      [{ id: "a", title: "A", sources: 250, checked_at: "" }],
      now,
    );
    expect(s.today.audio.used).toBe(2);
    expect(s.today.query.used).toBe(3);
    expect(s.today.blocked).toBe(false);
    expect(s.notebooks[0].level).toBe("warn");
  });
});
