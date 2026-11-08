import { describe, expect, it } from "vitest";
import { speakableSegments } from "@/lib/speak-segments";

describe("speakableSegments", () => {
  it("splits a foreign passage into sentences", () => {
    const s = speakableSegments("I like cats. Do you?", "en", false);
    expect(s.map((x) => x.text)).toEqual(["I like cats.", "Do you?"]);
  });
  it("picks only English example sentences out of Chinese explanation", () => {
    const t = "現在式第三人稱要加 s，例如：She plays soccer every day. 否定用 doesn't。";
    const s = speakableSegments(t, "en", true);
    expect(s.map((x) => x.text)).toEqual(["She plays soccer every day."]);
    expect(t.slice(s[0].start, s[0].start + s[0].text.length)).toBe(s[0].text);
  });
  it("needs kana for Japanese in mixed text", () => {
    const s = speakableSegments("例句：私は学生です。中文說明", "ja", true);
    expect(s.map((x) => x.text)).toEqual(["私は学生です。"]);
  });
});
