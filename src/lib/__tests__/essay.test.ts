import { describe, expect, it } from "vitest";
import { bandsToScore, essayPrompts, needsRegrade, parseCheckScore, parseEssayFeedback, wordCount } from "../essay";
import { essayPrompt } from "../essay-grade";

describe("essay", () => {
  it("converts four 0-5 bands to 100", () => {
    expect(bandsToScore({ content: 5, organization: 5, grammar: 5, vocabulary: 5 })).toBe(100);
    expect(bandsToScore({ content: 4, organization: 3, grammar: 4, vocabulary: 4 })).toBe(75);
  });
  it("flags regrade when gap > 10", () => {
    expect(needsRegrade(80, 70)).toBe(false);
    expect(needsRegrade(80, 65)).toBe(true);
  });
  it("parses feedback, clamps bands and drops no-op edits", () => {
    const f = parseEssayFeedback(
      JSON.stringify({
        text: " I go park. ",
        content: { band: 7, note: "a" },
        organization: { band: 2, note: "b" },
        grammar: { band: -1, note: "c" },
        vocabulary: { band: 3.4, note: "d" },
        edits: [
          { original: "I go park.", corrected: "I went to the park.", why: "過去式" },
          { original: "Same.", corrected: "Same.", why: "" },
        ],
        comment: "好",
        tips: ["1", "2", "3", "4"],
        rewrite: "I went to the park.",
      }),
    );
    expect(f.text).toBe("I go park.");
    expect(f.bands).toEqual({ content: 5, organization: 2, grammar: 0, vocabulary: 3 });
    expect(f.score).toBe(50);
    expect(f.edits).toHaveLength(1);
    expect(f.tips).toHaveLength(3);
  });
  it("parses check score", () => {
    expect(parseCheckScore('{"content":4,"organization":4,"grammar":4,"vocabulary":4}')).toBe(80);
  });
  it("gives kids short prompts and adults GEPT-length prompts", () => {
    expect(essayPrompts(1, false)[0].target).toBe("約 5 句");
    expect(essayPrompts(4, true)[0].target).toContain("中高級");
  });
  it("counts words", () => {
    expect(wordCount("  I like   dogs ")).toBe(3);
    expect(wordCount("")).toBe(0);
  });
  it("includes text only when no photo", () => {
    expect(essayPrompt({ title: "T", level: "L2", kid: true, text: "Hello world" })).toContain("Hello world");
    expect(essayPrompt({ title: "T", level: "L2", kid: true, text: "", image: { base64: "x", mimeType: "image/jpeg" } })).toContain("transcribe");
  });
});
