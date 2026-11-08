import { describe, expect, it } from "vitest";
import { partChunkIndexes, partMeaning, spellChunks } from "../morph";
import { bandLine } from "../score-band";
import { DEFAULT_SPEED, nextSpeed, SPEED_RATE, speedOrder, usableSpeed } from "../speech-speed";

describe("朗讀語速三段輪流", () => {
  it("沒開快速只有慢速和一般兩段，開了才多 🐇，按一下換下一段", () => {
    expect(speedOrder(false)).toEqual(["slow", "normal"]);
    expect(speedOrder(true)).toEqual(["slow", "normal", "fast"]);
    expect(nextSpeed("slow", false)).toBe("normal");
    expect(nextSpeed("normal", false)).toBe("slow");
    expect(nextSpeed("normal", true)).toBe("fast");
    expect(nextSpeed("fast", true)).toBe("slow");
  });

  it("存著快速但後台關掉了就退回一般；快速比一般快、一般比慢速快", () => {
    expect(usableSpeed("fast", false)).toBe("normal");
    expect(usableSpeed("fast", true)).toBe("fast");
    expect(SPEED_RATE.slow).toBeLessThan(SPEED_RATE.normal);
    expect(SPEED_RATE.normal).toBeLessThan(SPEED_RATE.fast);
  });

  it("單字卡預設慢速，其他地方一般", () => {
    expect(DEFAULT_SPEED.cards).toBe("slow");
    expect(DEFAULT_SPEED.read).toBe("normal");
    expect(DEFAULT_SPEED.listen).toBe("normal");
  });
});

describe("單字卡拆解亮燈", () => {
  const parts = [
    { text: "ap-", meaning: "向", kind: "prefix" as const },
    { text: "proxim", meaning: "接近", kind: "root" as const },
    { text: "-ate", meaning: "動詞", kind: "suffix" as const },
    { text: "-ly", meaning: "副詞", kind: "suffix" as const },
  ];
  it("每個泡泡對應到它涵蓋的拼字塊", () => {
    const chunks = spellChunks("approximately", parts);
    expect(chunks.join("")).toBe("approximately");
    const map = partChunkIndexes(chunks, parts);
    expect(map).toHaveLength(4);
    expect(map[0]).toEqual([0]);
    // 每一塊都至少屬於一個泡泡
    expect(new Set(map.flat()).size).toBe(chunks.length);
  });

  it("詞性加括號，其他意思照原樣", () => {
    expect(partMeaning("動詞")).toBe("(動詞)");
    expect(partMeaning("副詞")).toBe("(副詞)");
    expect(partMeaning("接近")).toBe("接近");
  });
});

describe("跟讀燈號文字", () => {
  it("🟢 不錯喔／🟡 能更好／🔴 再試試，分數只在講評裡", () => {
    expect(bandLine(0.92)).toBe("🟢 不錯喔・本次最高 92 分");
    expect(bandLine(0.7, 0.8)).toBe("🟡 能更好・本次最高 80 分");
    expect(bandLine(0.3)).toBe("🔴 再試試・本次最高 30 分");
  });
});
