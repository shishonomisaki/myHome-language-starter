import { describe, expect, it } from "vitest";
import { homeworkPrompt, isDailyQuota, parseFeedback, parseHomework, PASS_SCORE, speechPrompt } from "../gemini";

describe("parseFeedback", () => {
  it("keeps a clean high score", () => {
    const f = parseFeedback(JSON.stringify({ heard: "I like milk", score: 0.95, tip: "很好", issues: [] }));
    expect(f.score).toBe(0.95);
  });

  it("never passes when any issue is reported", () => {
    const f = parseFeedback(
      JSON.stringify({
        heard: "I lik milk",
        score: 0.95,
        tip: "",
        issues: [{ word: "like", kind: "vowel_length", fix: "i 要唸長", pair: ["lick", "like"] }],
      }),
    );
    expect(f.score).toBeLessThan(PASS_SCORE);
    expect(f.issues[0].pair).toEqual(["lick", "like"]);
  });

  it("clamps bad values and unknown kinds", () => {
    const f = parseFeedback(JSON.stringify({ heard: 1, score: 7, issues: [{ word: "x", kind: "weird" }] }));
    expect(f.issues[0].kind).toBe("other");
    expect(f.score).toBeLessThan(PASS_SCORE);
  });

  it("rejects non-numeric scores", () => {
    expect(() => parseFeedback(JSON.stringify({ score: "a" }))).toThrow();
  });
});

describe("speechPrompt", () => {
  it("asks for long vowels in Japanese and vowel length in English", () => {
    expect(speechPrompt("おばあさん", "ja")).toContain("おばさん/おばあさん");
    expect(speechPrompt("ship", "en")).toContain("ship/sheep");
  });
});

describe("parseHomework", () => {
  it("keeps valid entries and drops empty ones", () => {
    const h = parseHomework(
      JSON.stringify({
        transcript: "I have a red pen.",
        words: [{ word: "pen", meaning: "筆" }, { word: "", meaning: "x" }],
        phrases: [],
        grammar: [{ point: "have 表示擁有", example: "I have a pen." }],
        sentences: ["I have a red pen."],
        issues: [{ word: "pen", kind: "vowel_quality", fix: "e 嘴巴張開", pair: ["pen", "pan"] }],
      }),
    );
    expect(h.words).toEqual([{ word: "pen", meaning: "筆" }]);
    expect(h.grammar).toHaveLength(1);
    expect(h.issues[0].pair).toEqual(["pen", "pan"]);
  });
});

describe("homeworkPrompt", () => {
  it("mentions the textbook photo only when one is sent", () => {
    expect(homeworkPrompt(true)).toContain("photo");
    expect(homeworkPrompt(false)).not.toContain("photo");
  });
});

describe("homework extension", () => {
  it("keeps valid questions and drops broken ones", () => {
    const h = parseHomework(
      JSON.stringify({
        transcript: "x",
        words: [],
        phrases: [],
        grammar: [],
        sentences: [],
        issues: [],
        extension: {
          words: [{ word: "zoo", meaning: "動物園" }],
          title: "At the Zoo",
          text: "We go to the zoo.",
          questions: [
            { q: "他們去哪裡？", choices: ["動物園", "學校"], answer: 0 },
            { q: "壞題", choices: ["a"], answer: 3 },
          ],
        },
      }),
    );
    expect(h.extension?.questions).toHaveLength(1);
    expect(h.extension?.words[0].word).toBe("zoo");
  });

  it("asks for material at the target level", () => {
    expect(homeworkPrompt(false, "L2 英檢初級")).toContain("L2 英檢初級");
  });
});

describe("isDailyQuota", () => {
  it("tells the daily cap from the per-minute limit", () => {
    expect(isDailyQuota('"quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier"')).toBe(true);
    expect(isDailyQuota('"quotaId": "GenerateRequestsPerMinutePerProjectPerModel-FreeTier"')).toBe(false);
  });
});
