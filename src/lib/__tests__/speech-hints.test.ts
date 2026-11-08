import { describe, expect, it } from "vitest";
import { findRoots, hintPattern } from "../morph";
import { joinTranscripts, recognitionProblem, voiceScore } from "../speech";
import { presentQuestion, questionMode, readingScore, READINGS } from "../../content/readings";

describe("跟讀辨識", () => {
  it("no-speech、aborted 不算錯，其他錯誤翻成中文", () => {
    expect(recognitionProblem("no-speech")).toBeUndefined();
    expect(recognitionProblem("aborted")).toBeUndefined();
    expect(recognitionProblem("not-allowed")).toContain("麥克風");
    expect(recognitionProblem("network")).toContain("連網");
  });

  it("連續辨識把每一段接起來", () => {
    const r = (t: string, isFinal = true) => ({ isFinal, 0: { transcript: t } });
    expect(joinTranscripts([r("I have a cat."), r(" My cat is small", false)])).toBe("I have a cat. My cat is small");
    expect(joinTranscripts([])).toBe("");
  });

  it("日語朗讀只挑日語語音", () => {
    const v = (name: string, lang: string) => ({ name, lang, localService: false });
    expect(voiceScore(v("Google 日本語", "ja-JP"), "ja")).toBeGreaterThan(0);
    expect(voiceScore(v("Google US English", "en-US"), "ja")).toBe(-1);
    expect(voiceScore(v("Microsoft Nanami Online (Natural)", "ja_JP"), "ja")).toBeGreaterThan(20);
  });
});

describe("拼寫提示", () => {
  it("錯越多次提示越多，拼對過的塊直接顯示", () => {
    const chunks = ["in", "spec", "tion"];
    expect(hintPattern(chunks, 0)).toEqual(["i_", "____", "____"]);
    expect(hintPattern(chunks, 1, new Set([2]))).toEqual(["i_", "____", "tion"]);
    expect(hintPattern(chunks, 2)).toEqual(["i_", "s___", "t___"]);
    expect(hintPattern(chunks, 3)).toEqual(["i_", "s__c", "t__n"]);
  });

  it("找得到字中間的字根，整個字就是字根時不算", () => {
    expect(findRoots("inspection").map((r) => r.text)).toEqual(["spect"]);
    expect(findRoots("telephone").map((r) => r.text)).toEqual(expect.arrayContaining(["tele", "phon"]));
    expect(findRoots("form")).toEqual([]);
    expect(findRoots("cat")).toEqual([]);
  });
});

describe("短文問答語言", () => {
  it("0–1 級中文、2 級雙語、3 級起全外語", () => {
    expect(questionMode(0)).toBe("zh");
    expect(questionMode(1)).toBe("zh");
    expect(questionMode(2)).toBe("both");
    expect(questionMode(4)).toBe("target");
  });

  it("每篇短文的每一題都有外語版本，選項數量一致", () => {
    for (const r of READINGS)
      for (const q of r.questions) {
        expect(q.qT, `${r.id} ${q.q}`).toBeTruthy();
        expect(q.choicesT?.length).toBe(q.choices.length);
      }
    const q = READINGS[0].questions[0];
    expect(presentQuestion(q, "zh").q).toBe(q.q);
    expect(presentQuestion(q, "both")).toMatchObject({ q: q.qT, sub: q.q });
    expect(presentQuestion(q, "target").sub).toBeUndefined();
  });

  it("點了看中文或答錯時，外語題目附上中文題目和選項", () => {
    const q = READINGS[0].questions[0];
    const shown = presentQuestion(q, "target", true);
    expect(shown.sub).toBe(q.q);
    expect(shown.choices[0]).toBe(`${q.choicesT![0]}（${q.choices[0]}）`);
    expect(presentQuestion(q, "zh", true).choices).toEqual(q.choices);
  });

  it("看了中文才答對只算半題", () => {
    const qs = READINGS[0].questions;
    const all = Object.fromEntries(qs.map((q, i) => [i, q.answer]));
    expect(readingScore(qs, all, {})).toBe(qs.length);
    expect(readingScore(qs, all, { 0: true })).toBe(qs.length - 0.5);
    expect(readingScore(qs, { ...all, 1: (qs[1].answer + 1) % qs[1].choices.length }, {})).toBe(qs.length - 1);
  });

  it("長篇短文：5 級以上至少 200 字、4 題", () => {
    const long = READINGS.filter((r) => r.language === "en" && r.level >= 5);
    expect(long.length).toBeGreaterThanOrEqual(3);
    for (const r of long) {
      expect(r.text.split(/\s+/).length).toBeGreaterThanOrEqual(200);
      expect(r.questions.length).toBeGreaterThanOrEqual(4);
    }
    for (const r of READINGS) for (const q of r.questions) expect(q.answer).toBeLessThan(q.choices.length);
  });
});

describe("朗讀分段", () => {
  it("長文一句一句切，太長的句子在逗號或空白切開", async () => {
    const { splitForSpeech } = await import("../speech");
    const { forShortSpeech, pickVoice, voicesFor } = await import("../speech");
    const voices = [
      { name: "Microsoft Haruka", lang: "ja-JP", localService: true },
      { name: "Google 日本語", lang: "ja-JP", localService: false },
      { name: "Google US English", lang: "en-US", localService: false },
    ] as SpeechSynthesisVoice[];
    expect(voicesFor(voices, "ja").map((v) => v.name)).toEqual(["Google 日本語", "Microsoft Haruka"]);
    expect(pickVoice(voices, "ja")?.name).toBe("Google 日本語");
    expect(forShortSpeech("あ", "ja", 0.85)).toEqual({ text: "あ。あ。あ。", rate: 0.7 });
    expect(forShortSpeech("ねこ", "ja", 0.85).text).toBe("ねこ。ねこ。ねこ。");
    expect(forShortSpeech("a", "en", 0.85)).toEqual({ text: "a", rate: 0.85 });
    const { splitWithOffsets, wordEnd, withTitle } = await import("../speech");
    const text = "I have a cat.  My cat is small!";
    for (const p of splitWithOffsets(text)) expect(text.slice(p.start, p.start + p.text.length)).toBe(p.text);
    expect(wordEnd("My cat is small!", 3)).toBe(6);
    expect(wordEnd("My cat is small!", 3, 3)).toBe(6);
    expect(withTitle("Sunday", "We go.", "en")).toEqual({ spoken: "Sunday. We go.", textStart: 8 });
    expect(withTitle("Are you OK?", "Yes.", "en").spoken).toBe("Are you OK? Yes.");
    expect(withTitle("ねこ", "かわいい。", "ja")).toEqual({ spoken: "ねこ。かわいい。", textStart: 3 });
    expect(splitForSpeech("I have a cat. My cat is small!")).toEqual(["I have a cat.", "My cat is small!"]);
    expect(splitForSpeech("きょう いきました。おいしかったです。")).toEqual(["きょう いきました。", "おいしかったです。"]);
    const long = "word ".repeat(60).trim() + ".";
    const parts = splitForSpeech(long, 50);
    expect(parts.every((p) => p.length <= 50)).toBe(true);
    expect(parts.join(" ")).toBe(long);
  });
});

describe("理解題數量", () => {
  it("0–1 級至少 4 題，2 級以上至少 5 題；補題的 id 都對得上", async () => {
    const { READINGS } = await import("@/content/readings");
    const { EXTRA_QUESTIONS } = await import("@/content/readings-extra-questions");
    for (const r of READINGS) expect(r.questions.length, r.id).toBeGreaterThanOrEqual(r.level <= 1 ? 4 : 5);
    const ids = new Set(READINGS.map((r) => r.id));
    for (const id of Object.keys(EXTRA_QUESTIONS)) expect(ids.has(id), id).toBe(true);
  });
});
