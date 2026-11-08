import { describe, expect, it } from "vitest";
import { makeQuestion } from "../quiz";
import { HIRAGANA } from "@/content/kana";
import { EN_VOCAB } from "@/content/vocab-en";

describe("quiz", () => {
  it("uses look-alike kana as distractors", () => {
    const sa = HIRAGANA.find((i) => i.prompt === "さ")!;
    const q = makeQuestion(sa, HIRAGANA, "sound", () => 0.5);
    expect(q.choices).toHaveLength(4);
    expect(q.choices[q.answerIndex]).toBe("さ");
    expect(q.choices).toEqual(expect.arrayContaining(["ち", "き"]));
  });

  it("asks meanings with unique choices", () => {
    const q = makeQuestion(EN_VOCAB[0], EN_VOCAB, "meaning");
    expect(new Set(q.choices).size).toBe(4);
    expect(q.choices[q.answerIndex]).toBe(EN_VOCAB[0].answer);
  });
});
