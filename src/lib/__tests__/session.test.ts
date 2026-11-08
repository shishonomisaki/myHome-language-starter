import { describe, expect, it } from "vitest";
import { LocalRepo } from "../repo";
import { finishSession } from "../session";
import { shadowingScore } from "../speech";

function memStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe("finishSession", () => {
  it("awards the daily goal once and persists across reloads", async () => {
    const storage = memStorage();
    const repo = new LocalRepo(storage);
    const r1 = await finishSession(repo, "kid-younger", [], [], 10); // 目標 15 分鐘
    expect(r1.goalJustMet).toBe(false);
    const r2 = await finishSession(repo, "kid-younger", [], [], 6);
    expect(r2.goalJustMet).toBe(true);
    expect(r2.streak).toBe(1);
    const r3 = await finishSession(repo, "kid-younger", [], [], 5);
    expect(r3.goalJustMet).toBe(false);

    const reloaded = new LocalRepo(storage);
    expect((await reloaded.getRewards("kid-younger")).points).toBe(10);
  });
});

describe("shadowingScore", () => {
  it("scores English by words and Japanese by characters", () => {
    expect(shadowingScore("I like milk.", "i like milk", "en")).toBe(1);
    expect(shadowingScore("I like milk", "i like", "en")).toBeCloseTo(2 / 3);
    expect(shadowingScore("ねこが すきです", "猫がすきです", "ja")).toBeCloseTo(5 / 7);
    expect(shadowingScore(["ねこが すきです", "猫が好きです"], "猫がすきです", "ja")).toBeCloseTo(5 / 6);
  });
});

describe("瀏覽器評分照順序比對", () => {
  it("多唸、順序亂掉都會扣分", () => {
    expect(shadowingScore("I like milk", "milk like I", "en")).toBeCloseTo(1 / 3);
    expect(shadowingScore("I like milk", "I really really like milk", "en")).toBeCloseTo(3 / 5);
  });
});
