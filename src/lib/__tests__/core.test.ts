import { describe, expect, it } from "vitest";
import { newCard, review, isDue } from "../srs";
import { currentStreak, onGoalMet, applyFreezeIfNeeded, emptyRewards, goalMetDates } from "../rewards";
import { startPlacement, answerPlacement, placementResult } from "../placement";
import { buildDailyPlan, languageMinutes } from "../plan";
import { ZERO_LEVELS, type FocusArea, type Learner } from "../types";
import { DEMO_FAMILY } from "../repo";

describe("srs", () => {
  it("lengthens intervals on correct answers and resets on mistakes", () => {
    let c = newCard("a", "x", "2026-10-21");
    expect(isDue(c, "2026-10-21")).toBe(true);
    c = review(c, true, "2026-10-21");
    expect(c.due).toBe("2026-10-22");
    c = review(c, true, "2026-10-22");
    expect(c.due).toBe("2026-10-24");
    c = review(c, false, "2026-10-24");
    expect(c).toMatchObject({ streak: 0, lapses: 1, due: "2026-10-25" });
  });
});

describe("rewards", () => {
  it("counts streak back from yesterday when today is not done yet", () => {
    const met = new Set(["2026-10-18", "2026-10-19", "2026-10-20"]);
    expect(currentStreak(met, [], "2026-10-21")).toBe(3);
    expect(currentStreak(new Set([...met, "2026-10-21"]), [], "2026-10-21")).toBe(4);
  });

  it("frozen dates keep the streak alive", () => {
    const met = new Set(["2026-10-18", "2026-10-20"]);
    expect(currentStreak(met, ["2026-10-19"], "2026-10-21")).toBe(3);
  });

  it("uses a freeze card for a single missed day", () => {
    const met = new Set(["2026-10-19"]);
    const s = applyFreezeIfNeeded({ ...emptyRewards("a"), freezeCards: 1 }, met, "2026-10-21");
    expect(s.freezeCards).toBe(0);
    expect(s.frozenDates).toEqual(["2026-10-20"]);
  });

  it("awards badges once and a freeze card every 7 days", () => {
    const r1 = onGoalMet(emptyRewards("a"), 7, 1);
    expect(r1.newBadges).toEqual(["streak:3", "streak:7"]);
    expect(r1.state.freezeCards).toBe(1);
    const r2 = onGoalMet(r1.state, 8, 1);
    expect(r2.newBadges).toEqual([]);
  });

  it("only counts days where the goal minutes were reached", () => {
    const met = goalMetDates(
      [
        { learnerId: "a", date: "2026-10-20", minutes: 10 },
        { learnerId: "a", date: "2026-10-20", minutes: 6 },
        { learnerId: "a", date: "2026-10-21", minutes: 5 },
      ],
      15,
    );
    expect([...met]).toEqual(["2026-10-20"]);
  });
});

describe("placement", () => {
  it("climbs on correct answers and settles where the learner is accurate", () => {
    let s = startPlacement(0, 3, 12);
    // 0、1 級全對，2 級開始全錯
    while (!s.done) s = answerPlacement(s, s.current < 2);
    expect(placementResult(s)).toBe(1);
  });

  it("returns 0 when everything is wrong", () => {
    let s = startPlacement(1, 3, 6);
    while (!s.done) s = answerPlacement(s, false);
    expect(placementResult(s)).toBe(0);
  });
});

const learner: Learner = {
  id: "a", nickname: "小明", role: "learner", isLearning: true, dailyMinutes: 30,
  languages: { en: 2, ja: 1 }, aiEnabled: true, avatar: "🦊",
};

describe("plan", () => {
  it("splits minutes by language weights", () => {
    expect(languageMinutes(learner)).toEqual({ en: 20, ja: 10 });
  });

  const levels = { vocab: 0, grammar: 0, reading: 0, listening: 0, speaking: 0 } as const;

  it("starts Japanese with a placement test that includes kana", () => {
    const tasks = buildDailyPlan({
      learner,
      perLanguage: {
        en: { placementDone: true, levels, dueReviews: 0, kanaMastered: true },
        ja: { placementDone: false, levels, dueReviews: 0, kanaMastered: false },
      },
    });
    expect(tasks.find((t) => t.language === "ja")?.kind).toBe("placement");
  });

  it("puts kana first for Japanese beginners after placement and fills the budget", () => {
    const tasks = buildDailyPlan({
      learner,
      perLanguage: {
        en: { placementDone: true, levels, dueReviews: 8, kanaMastered: true },
        ja: { placementDone: true, levels, dueReviews: 0, kanaMastered: false },
      },
    });
    expect(tasks.find((t) => t.language === "ja")?.kind).toBe("kana");
    const total = tasks.reduce((s, t) => s + t.minutes, 0);
    expect(total).toBe(30);
  });

  it("skips kana when placement shows the learner already reads it", () => {
    const tasks = buildDailyPlan({
      learner,
      perLanguage: {
        en: { placementDone: true, levels, dueReviews: 0, kanaMastered: true },
        ja: { placementDone: true, levels: { ...levels, vocab: 1, reading: 1 }, dueReviews: 0, kanaMastered: true },
      },
    });
    expect(tasks.some((t) => t.kind === "kana")).toBe(false);
  });

  it("puts class homework first and keeps the daily total unchanged", () => {
    const perLanguage = { en: { placementDone: true, levels, dueReviews: 0, kanaMastered: true } };
    const kid = { ...learner, languages: { en: 1 } };
    const tasks = buildDailyPlan({ learner: kid, perLanguage, homework: { recordedToday: false, practiceReady: true, extendReady: true } });
    expect(tasks[0].kind).toBe("homework");
    expect(tasks[1].kind).toBe("homework-practice");
    expect(tasks[2].kind).toBe("homework-extend");
    // 一半複習（含錄音）、一半延伸。
    expect(tasks[0].minutes + tasks[1].minutes).toBe(15);
    expect(tasks[2].minutes).toBe(15);
    expect(tasks.reduce((s, t) => s + t.minutes, 0)).toBe(kid.dailyMinutes);
  });

  it("mixes past homework on days without new homework to review", () => {
    const perLanguage = { en: { placementDone: true, levels, dueReviews: 0, kanaMastered: true } };
    const kid = { ...learner, languages: { en: 1 } };
    const idle = buildDailyPlan({ learner: kid, perLanguage, homework: { recordedToday: true, practiceReady: false, extendReady: false, mixReady: true } });
    expect(idle[0].kind).toBe("homework-mix");
    expect(idle.reduce((s, t) => s + t.minutes, 0)).toBe(kid.dailyMinutes);
    const busy = buildDailyPlan({ learner: kid, perLanguage, homework: { recordedToday: true, practiceReady: true, extendReady: false, mixReady: true } });
    expect(busy.some((t) => t.kind === "homework-mix")).toBe(false);
  });

  it("skips the recording once it is done today", () => {
    const perLanguage = { en: { placementDone: true, levels, dueReviews: 0, kanaMastered: true } };
    const tasks = buildDailyPlan({ learner, perLanguage, homework: { recordedToday: true, practiceReady: false, extendReady: false } });
    expect(tasks.some((t) => t.kind.startsWith("homework"))).toBe(false);
  });
});

describe("focus units", () => {
  const base = { placementDone: true, levels: ZERO_LEVELS, dueReviews: 0, kanaMastered: true };
  it("rotates the chosen area by day and fits inside the daily minutes", () => {
    const learner = { ...DEMO_FAMILY[0], dailyMinutes: 30 as const, languages: { en: 1 }, focus: { en: ["grammar", "pronunciation"] as FocusArea[] } };
    const d0 = buildDailyPlan({ learner, perLanguage: { en: base }, dayIndex: 0 });
    const d1 = buildDailyPlan({ learner, perLanguage: { en: base }, dayIndex: 1 });
    expect(d0.find((t) => t.kind === "focus")).toMatchObject({ area: "grammar", minutes: 10 });
    expect(d1.find((t) => t.kind === "focus")?.area).toBe("pronunciation");
    expect(d0.reduce((s, t) => s + t.minutes, 0)).toBe(30);
  });
  it("takes kids' focus time from the extension half", () => {
    const kid = { ...DEMO_FAMILY[2], dailyMinutes: 30 as const, languages: { en: 1 }, focus: { en: ["vocab"] as FocusArea[] } };
    const tasks = buildDailyPlan({ learner: kid, perLanguage: { en: base }, homework: { recordedToday: false, practiceReady: true, extendReady: true } });
    expect(tasks.map((t) => [t.kind, t.minutes])).toEqual([
      ["homework", 3],
      ["homework-practice", 12],
      ["focus", 10],
      ["homework-extend", 5],
    ]);
  });
  it("waits for placement", () => {
    const learner = { ...DEMO_FAMILY[0], languages: { en: 1 }, focus: { en: ["vocab"] as FocusArea[] } };
    const tasks = buildDailyPlan({ learner, perLanguage: { en: { ...base, placementDone: false } } });
    expect(tasks.some((t) => t.kind === "focus")).toBe(false);
  });
});

describe("games", () => {
  it("splits, checks and scores", async () => {
    const g = await import("../games");
    expect(g.sentenceChunks("I like red apples.")).toEqual(["I", "like", "red", "apples."]);
    expect(g.sentenceChunks("私は 学生 です。")).toEqual(["私は", "学生", "です。"]);
    expect(g.sameAnswer("i like red apples", "I like red apples.")).toBe(true);
    expect(g.dictationScore("I like apples", "I like red apples.", "en")).toBe(0.75);
    const s = g.scrambled([1, 2, 3]);
    expect(s).not.toEqual([1, 2, 3]);
    expect([...s].sort()).toEqual([1, 2, 3]);
  });
  it("prefers high-quality voices in the right language", async () => {
    const { voiceScore } = await import("../speech");
    const v = (name: string, lang: string) => ({ name, lang, localService: false });
    expect(voiceScore(v("Google US English", "en-US"), "en")).toBeGreaterThan(voiceScore(v("Fred", "en-US"), "en"));
    expect(voiceScore(v("Kyoko", "ja-JP"), "en")).toBe(-1);
  });
});

describe("item bank", () => {
  it("needs enough approved questions and splits them into practice and test", async () => {
    const { drillFromBank } = await import("../item-bank");
    const mcq = (i: number) => ({ id: i, kind: "mcq" as const, content: { q: `q${i}`, choices: ["a", "b"], answer: 1, explain: "" } });
    expect(drillFromBank([1, 2, 3].map(mcq), "t")).toBeNull();
    const d = drillFromBank([...Array.from({ length: 10 }, (_, i) => mcq(i)), { id: 99, kind: "pair", content: { term: "cat", meaning: "貓" } }], "t")!;
    expect(d.test).toHaveLength(5);
    expect(d.practice).toHaveLength(5);
    expect(new Set([...d.test, ...d.practice].map((q) => q.q)).size).toBe(10);
    expect(d.pairs).toEqual([{ term: "cat", meaning: "貓" }]);
  });
});

describe("one focus unit a day", () => {
  it("never stacks units across areas or languages", () => {
    const base = { placementDone: true, levels: ZERO_LEVELS, dueReviews: 0, kanaMastered: true };
    const learner = { ...DEMO_FAMILY[0], dailyMinutes: 60 as const, languages: { en: 1, ja: 1 }, focus: { en: ["vocab", "grammar"] as FocusArea[], ja: ["pronunciation"] as FocusArea[] } };
    const seen = new Set<string>();
    for (let d = 0; d < 3; d++) {
      const f = buildDailyPlan({ learner, perLanguage: { en: base, ja: base }, dayIndex: d }).filter((t) => t.kind === "focus");
      expect(f).toHaveLength(1);
      expect(f[0].minutes).toBe(10);
      seen.add(`${f[0].language}:${f[0].area}`);
    }
    expect(seen.size).toBe(3);
  });
});

describe("placement reaches high levels", () => {
  it("can place a strong learner at L6 within 20 questions starting from L2", () => {
    let s = startPlacement(2, 6, 20);
    while (!s.done) s = answerPlacement(s, true);
    expect(placementResult(s)).toBe(6);
  });
});

describe("word parts for spelling", () => {
  it("finds affixes, part of speech and chunks that rebuild the word", async () => {
    const { analyzeWord } = await import("../morph");
    const a = analyzeWord("environment");
    expect(a.suffix?.text).toBe("ment");
    expect(a.suffix?.pos).toBe("名詞");
    expect(a.chunks.join("")).toBe("environment");
    expect(a.chunks.length).toBeGreaterThanOrEqual(3);
    const b = analyzeWord("unbelievable");
    expect(b.prefix?.text).toBe("un");
    expect(b.suffix?.text).toBe("able");
    expect(analyzeWord("competition").combos).toContain("tion");
    for (const w of ["cat", "apple", "library", "temperature", "responsible", "ubiquitous"]) expect(analyzeWord(w).chunks.join("")).toBe(w);
    expect(analyzeWord("cat").chunks).toEqual(["cat"]);
  });
});

import { drillFromBank, silentListening } from "@/lib/item-bank";
describe("bank listening audio", () => {
  it("keeps per-question audio", () => {
    const rows = Array.from({ length: 9 }, (_, i) => ({ id: i, kind: "mcq" as const, content: { q: "Q", choices: ["a", "b"], answer: 0, audio: `say ${i}` } }));
    const d = drillFromBank(rows, "t")!;
    expect([...d.practice, ...d.test].every((q) => q.audio)).toBe(true);
    expect(silentListening(d)).toBe(false);
    expect(silentListening({ ...d, practice: d.practice.map(({ audio: _a, ...q }) => q), test: [] })).toBe(true);
  });
});

import { parseLanguage, LEVEL_LABELS as LL } from "@/lib/types";
import { VOCAB as V } from "@/content";
import { ES_READINGS } from "@/content/readings-es";
describe("西班牙語", () => {
  it("認得 es 語言代碼", () => {
    expect(parseLanguage("es")).toBe("es");
    expect(parseLanguage("xx")).toBe("en");
    expect(LL.es[1]).toContain("A1");
  });
  it("字彙 L0–L2 都有，id 不重複", () => {
    for (const l of [0, 1, 2]) expect(V.es.filter((i) => i.level === l).length).toBeGreaterThanOrEqual(40);
    expect(new Set(V.es.map((i) => i.id)).size).toBe(V.es.length);
  });
  it("短文的答案都在選項內", () => {
    for (const r of ES_READINGS) for (const q of r.questions) expect(q.answer).toBeLessThan(q.choices.length);
  });
});

import { ambiguousPairs, labelAmbiguousPairs } from "../games";
describe("配對題意思要分得出來", () => {
  it("effect / affect 同為「影響」會被補上提示", () => {
    const p = labelAmbiguousPairs([
      { term: "effect", meaning: "影響" },
      { term: "affect", meaning: "影響" },
      { term: "cat", meaning: "貓" },
    ]);
    expect(p[0].meaning).not.toBe(p[1].meaning);
    expect(p[2].meaning).toBe("貓");
    expect(ambiguousPairs(p)).toEqual([]);
  });
  it("advice / advise 前兩個字母一樣也分得開", () => {
    const p = labelAmbiguousPairs([
      { term: "advice", meaning: "建議" },
      { term: "advise", meaning: "(動) 建議" },
    ]);
    expect(p[0].meaning).toContain("advic");
    expect(p[1].meaning).toContain("advis");
  });
  it("已標好詞性的不再加", () => {
    const p = [
      { term: "effect", meaning: "(名) 效果、影響" },
      { term: "affect", meaning: "(動) 影響" },
    ];
    expect(ambiguousPairs(p)).toEqual([]);
  });
});

import { blankOut, confusableGroups } from "../games";
describe("易混字教學卡", () => {
  it("找出 effect/affect 一組", () => {
    expect(confusableGroups([{ term: "effect", meaning: "影響" }, { term: "cat", meaning: "貓" }, { term: "affect", meaning: "影響" }])).toEqual([[0, 2]]);
  });
  it("詞性放前面後兩個意思就分得開", () => {
    expect(labelAmbiguousPairs([{ term: "effect", meaning: "影響", pos: "名" }, { term: "affect", meaning: "影響", pos: "動" }]).map((p) => p.meaning)).toEqual(["影響（名詞）", "影響（動詞）"]);
  });
  it("例句挖空", () => {
    expect(blankOut("Rain can affect the game.", "affect")).toBe("Rain can ___ the game.");
    expect(blankOut("Hello", "affect")).toBeNull();
  });
});
