import { describe, expect, it } from "vitest";
import { orderReadings, READINGS } from "@/content/readings";

const en = READINGS.filter((r) => r.language === "en");

describe("orderReadings", () => {
  it("L3 做完附近的短文，也不會跳到 L5、L6", () => {
    const done = new Set(en.filter((r) => r.level >= 2 && r.level <= 4).map((r) => r.id));
    const ordered = orderReadings(en, 3, done);
    expect(ordered.every((r) => r.level >= 2 && r.level <= 4)).toBe(true);
    expect(ordered[0].level).toBe(3);
  });

  it("同樣距離時沒做過的先出，低一級比高一級先", () => {
    const ordered = orderReadings(en, 3, new Set(["en-r-sleep"]));
    const l3 = en.filter((r) => r.level === 3).length;
    expect(ordered.slice(0, l3 - 1).every((r) => r.level === 3 && r.id !== "en-r-sleep")).toBe(true);
    expect(ordered[l3 - 1].id).toBe("en-r-sleep");
    expect(ordered[l3].level).toBe(2);
  });

  it("範圍內沒有短文時退回最接近的一篇", () => {
    expect(
      orderReadings(
        en.filter((r) => r.level === 0),
        4,
        new Set(),
      ),
    ).toHaveLength(1);
  });
});

describe("分級短文題庫", () => {
  it("id 不重複，答案都在選項範圍內，中外文選項數一致", () => {
    expect(new Set(READINGS.map((r) => r.id)).size).toBe(READINGS.length);
    for (const r of READINGS)
      for (const q of r.questions) {
        expect(q.answer).toBeLessThan(q.choices.length);
        if (q.choicesT) expect(q.choicesT.length).toBe(q.choices.length);
      }
  });

  it("英文每級至少 6 篇，日文 L1–L3 每級至少 6 篇", () => {
    const count = (lang: string, level: number) => READINGS.filter((r) => r.language === lang && r.level === level).length;
    for (let l = 0; l <= 6; l++) expect(count("en", l)).toBeGreaterThanOrEqual(6);
    for (const l of [1, 2, 3]) expect(count("ja", l)).toBeGreaterThanOrEqual(6);
  });
});
