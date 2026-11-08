import { describe, expect, it } from "vitest";
import { EN_VOCAB } from "@/content/vocab-en";
import { WORD_PARTS } from "@/content/word-parts";
import { partsLabel, partText, spellChunks } from "../morph";

describe("字首字根字尾拆解", () => {
  it("每個拆解合起來就是原字，而且字庫裡有這個字", () => {
    const words = new Set(EN_VOCAB.map((i) => i.prompt));
    for (const [word, parts] of Object.entries(WORD_PARTS)) {
      expect(parts.map(partText).join("")).toBe(word);
      expect(words.has(word)).toBe(true);
    }
  });

  it("有拆解的字卡帶著拆解，拼字塊照拆解切", () => {
    const item = EN_VOCAB.find((i) => i.prompt === "prevent")!;
    expect(item.parts?.map((p) => p.kind)).toEqual(["prefix", "root"]);
    expect(spellChunks("prevent", item.parts)).toEqual(["pre", "vent"]);
    expect(partsLabel(item.parts!)).toBe("pre-（事先） ＋ vent（來）");
  });

  it("太長的字根再切音節；沒有拆解就用自動拆解", () => {
    expect(spellChunks("fundamental", WORD_PARTS.fundamental).join("")).toBe("fundamental");
    expect(spellChunks("fundamental", WORD_PARTS.fundamental).length).toBeGreaterThan(2);
    expect(spellChunks("apple").join("")).toBe("apple");
  });
});

describe("拼錯差在哪", () => {
  it("只記得開頭和結尾：標出中間少了幾個字母", async () => {
    const { spellDiff } = await import("../morph");
    expect(spellDiff("aable", "available")).toEqual({ head: 1, tail: 4, middle: "", gap: 4 });
    expect(spellDiff("avialable", "available")).toMatchObject({ head: 2, tail: 5 });
    expect(spellDiff("availlable", "available")).toMatchObject({ head: 5, gap: 0, middle: "l" });
  });
});
