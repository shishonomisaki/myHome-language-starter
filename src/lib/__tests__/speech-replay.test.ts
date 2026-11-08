import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (e: unknown) => void;

class FakeUtterance {
  text: string;
  lang = "";
  voice: unknown = null;
  rate = 1;
  volume = 1;
  onstart: Listener | null = null;
  onboundary: Listener | null = null;
  onerror: Listener | null = null;
  listeners: Record<string, Listener[]> = {};
  constructor(text: string) {
    this.text = text;
  }
  addEventListener(name: string, fn: Listener) {
    (this.listeners[name] ??= []).push(fn);
  }
}

function setup() {
  const spoken: FakeUtterance[] = [];
  const synth = {
    speaking: false,
    pending: false,
    paused: false,
    getVoices: () => [{ lang: "en-US", name: "Test", localService: true, default: true }],
    cancel: vi.fn(() => {
      synth.speaking = false;
    }),
    resume: vi.fn(),
    speak: (u: FakeUtterance) => {
      spoken.push(u);
      synth.speaking = true;
    },
  };
  vi.stubGlobal("window", { speechSynthesis: synth, dispatchEvent: () => true, addEventListener: () => {}, setTimeout });
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  vi.stubGlobal("CustomEvent", class {});
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
  return { synth, spoken };
}

describe("重唸／放慢時的卡拉OK標示", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("重唸會先把標示移到那一句，打斷舊語音後隔一下才開始唸", async () => {
    const { synth, spoken } = setup();
    const speech = await import("../speech");
    const progress: unknown[] = [];
    const text = "One two. Three four.";
    void speech.speak(text, "en", 0.8, (p) => progress.push(p));
    expect(spoken).toHaveLength(2);
    spoken[1].onstart?.({});
    progress.length = 0;

    speech.replaySentence(true);
    await Promise.resolve();
    expect(synth.cancel).toHaveBeenCalled();
    expect(progress.at(-1)).toEqual({ sentence: [9, 20] });
    expect(spoken).toHaveLength(2);

    vi.advanceTimersByTime(speech.CANCEL_GAP_MS);
    expect(spoken).toHaveLength(3);
    expect(spoken[2].text).toBe("Three four.");
    expect(spoken[2].rate).toBe(speech.SLOW_RATE);
    spoken[2].onboundary?.({ name: "word", charIndex: 6, charLength: 4 });
    expect(progress.at(-1)).toEqual({ sentence: [9, 20], word: [15, 19] });
  });
});

describe("語音沒回報唸到哪個字時用時間估計", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("estimateWord 依時間找出英文單字、日文單字元", async () => {
    const { estimateWord } = await import("../speech");
    expect(estimateWord("One two three.", 0, 1, "en")).toEqual([0, 3]);
    expect(estimateWord("One two three.", 400, 1, "en")).toEqual([4, 7]);
    expect(estimateWord("One two three.", 400, 0.5, "en")).toEqual([0, 3]);
    expect(estimateWord("One two three.", 5000, 1, "en")).toBeNull();
    expect(estimateWord("おはよう。", 300, 1, "ja")).toEqual([2, 3]);
  });

  it("沒有 boundary 時會自己移動逐字標示，有 boundary 就停止估計", async () => {
    const { spoken } = setup();
    const speech = await import("../speech");
    const progress: { word?: [number, number] }[] = [];
    void speech.speak("One two three four five six.", "en", 1, (p) => p && progress.push(p));
    spoken[0].onstart?.({});
    vi.advanceTimersByTime(speech.ESTIMATE_AFTER_MS + 300);
    expect(progress.at(-1)?.word).toBeDefined();
    spoken[0].onboundary?.({ name: "word", charIndex: 0, charLength: 3 });
    const count = progress.length;
    vi.advanceTimersByTime(700);
    expect(progress.length).toBe(count);
  });
  it("boundary 斷掉一陣子，會從上一個字接著估計", async () => {
    const { spoken } = setup();
    const speech = await import("../speech");
    const progress: { word?: [number, number] }[] = [];
    void speech.speak("One two three four five six.", "en", 1, (p) => p && progress.push(p));
    spoken[0].onstart?.({});
    spoken[0].onboundary?.({ name: "word", charIndex: 8, charLength: 5 });
    vi.advanceTimersByTime(speech.RESUME_ESTIMATE_MS + 300);
    expect(progress.at(-1)?.word?.[0]).toBeGreaterThan(8);
  });

  it("標點後面算停頓，估計不會跑在語音前面", async () => {
    const { estimateAt } = await import("../speech");
    // 「Hi, there」：唸到 there 之前要先過逗號的停頓。
    expect(estimateAt("Hi, there friend.", 0, 300, 14, "en")).toEqual([0, 2]);
    expect(estimateAt("Hi, there friend.", 0, 700, 14, "en")).toEqual([4, 9]);
  });

  it("量到這個語音實際的速度後，下次照量到的速度估計", async () => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => (store[k] = v),
      removeItem: () => {},
    });
    const { loadPace, savePace, spokenLength, defaultPace } = await import("../speech");
    const part = "One two three four five six seven.";
    expect(loadPace("Ava", 0.4, "en")).toBe(defaultPace(0.4, "en"));
    savePace("Ava", 0.4, part, 4000);
    expect(loadPace("Ava", 0.4, "en")).toBeCloseTo(spokenLength(part) / 4);
    // 沒量過的語速，用同一個語音量到的速度依語速換算；別的語音不受影響。
    expect(loadPace("Ava", 0.8, "en")).toBeCloseTo((spokenLength(part) / 4) * Math.pow(2, 0.75));
    expect(loadPace("Bob", 1, "en")).toBe(defaultPace(1, "en"));
  });

  it("每唸完一句就往實際速度靠過去，連續偏掉也會很快校正", async () => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => (store[k] = v),
      removeItem: () => {},
    });
    const { loadPace, savePace, spokenLength } = await import("../speech");
    const part = "One two three four five six seven.";
    const real = spokenLength(part) / 3;
    savePace("Ava", 0.85, part, 6000);
    for (let i = 0; i < 4; i++) savePace("Ava", 0.85, part, 3000);
    expect(Math.abs(loadPace("Ava", 0.85, "en") - real) / real).toBeLessThan(0.1);
  });
});

describe("一般／慢速切換時亮燈不落後", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("切到慢速後收不到 onstart，逐字亮燈仍會自己往前走", async () => {
    const { spoken } = setup();
    const speech = await import("../speech");
    const progress: { word?: [number, number] }[] = [];
    const text = "One two three four five six seven eight nine ten.";
    void speech.speak(text, "en", 0.8, (p) => p && progress.push(p));
    spoken[0].onstart?.({});
    vi.advanceTimersByTime(1000);
    // 唸到一半按慢速：Chrome 打斷後重唸，新句子不發 onstart。
    void speech.speak(text, "en", speech.SLOW_RATE, (p) => p && progress.push(p));
    await Promise.resolve();
    vi.advanceTimersByTime(speech.CANCEL_GAP_MS);
    expect(spoken).toHaveLength(2);
    progress.length = 0;
    vi.advanceTimersByTime(speech.START_FALLBACK_MS + speech.ESTIMATE_AFTER_MS + 2000);
    const words = progress.map((p) => p.word?.[0]).filter((w): w is number => w !== undefined);
    expect(words.length).toBeGreaterThan(0);
    expect(Math.max(...words)).toBeGreaterThan(0);
  });

  it("下一句收不到 onstart 時，從上一句結束開始計時", async () => {
    const { spoken } = setup();
    const speech = await import("../speech");
    const progress: { sentence: [number, number]; word?: [number, number] }[] = [];
    void speech.speak("One two three. Four five six seven eight.", "en", 1, (p) => p && progress.push(p));
    spoken[0].onstart?.({});
    vi.advanceTimersByTime(800);
    for (const fn of spoken[0].listeners.end ?? []) fn({});
    vi.advanceTimersByTime(1500);
    const last = progress.at(-1);
    expect(last?.sentence).toEqual([15, 41]);
    expect(last?.word?.[0]).toBeGreaterThan(15);
  });

  it("每一句開始才讀速度，前一句量到的速度馬上用上", async () => {
    const store: Record<string, string> = {};
    const { spoken } = setup();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => (store[k] = v),
      removeItem: () => {},
    });
    const speech = await import("../speech");
    const progress: { sentence: [number, number]; word?: [number, number] }[] = [];
    const first = "One two three four five six seven.";
    const second = "Aaa bbb ccc ddd eee fff ggg hhh iii jjj.";
    void speech.speak(`${first} ${second}`, "en", 0.4, (p) => p && progress.push(p));
    spoken[0].onstart?.({});
    // 這個語音在慢速其實唸得比預設快很多：1 秒就唸完第一句。
    vi.advanceTimersByTime(1000);
    for (const fn of spoken[0].listeners.end ?? []) fn({});
    spoken[1].onstart?.({});
    vi.advanceTimersByTime(1000);
    const at = progress.at(-1)?.word?.[0] ?? 0;
    const offset = first.length + 1;
    // 用預設慢速（約每秒 5.6 字元）只會停在前一兩個字；用量到的速度應該已經唸到後半。
    expect(at - offset).toBeGreaterThan(second.length / 2);
  });
});

import { resumeDelay } from "../speech";
it("resumeDelay waits about two words, between 0.5s and 1.5s", () => {
  expect(resumeDelay(12, "en")).toBe(1000);
  expect(resumeDelay(30, "en")).toBe(500);
  expect(resumeDelay(4, "en")).toBe(1500);
});

import { nextWord } from "../speech";
it("nextWord finds the start of the following word", () => {
  expect(nextWord("One two three.", 0, "en")).toBe(4);
  expect(nextWord("One two three.", 4, "en")).toBe(8);
  expect(nextWord("One two three.", 8, "en")).toBeNull();
  expect(nextWord("おはよう", 1, "ja")).toBe(2);
  expect(nextWord("abc", -1, "en")).toBe(0);
});
