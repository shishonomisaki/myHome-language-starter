import { afterEach, describe, expect, it, vi } from "vitest";
import { GEMINI_MODELS, scoreSpeech, skipReason, type GeminiCall } from "../gemini";

const ok = { candidates: [{ content: { parts: [{ text: JSON.stringify({ heard: "hi", score: 0.9, tip: "", issues: [] }) }] } }] };
const quota = { error: { code: 429, details: [{ violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] }] } };

describe("跳過主要模型時記下原因", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("skipReason 優先取額度名稱，其次是錯誤訊息", () => {
    expect(skipReason(JSON.stringify(quota))).toBe("GenerateRequestsPerDayPerProjectPerModel-FreeTier");
    expect(skipReason(JSON.stringify({ error: { message: "models/x is not found" } }))).toBe("models/x is not found");
  });

  it("主要模型 429 時改用備用模型，並記下跳過的原因", async () => {
    const fetch = vi.fn(async (url: string) =>
      url.includes(GEMINI_MODELS[0]) ? new Response(JSON.stringify(quota), { status: 429 }) : new Response(JSON.stringify(ok)),
    );
    vi.stubGlobal("fetch", fetch);
    const call: GeminiCall = { apiKey: "k" };
    const f = await scoreSpeech(call, { base64: "", mimeType: "audio/webm" }, "hi", "en");
    expect(f.score).toBe(0.9);
    expect(call.model).toBe(GEMINI_MODELS[1]);
    expect(call.skipped).toEqual([{ model: GEMINI_MODELS[0], status: 429, reason: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }]);
  });

  it("最後一個模型也 404 時，錯誤訊息仍帶回應內容", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "not found" } }), { status: 404 })),
    );
    const call: GeminiCall = { apiKey: "k" };
    await expect(scoreSpeech(call, { base64: "", mimeType: "audio/webm" }, "hi", "en")).rejects.toThrow(/Gemini 404: .*not found/);
    expect(call.skipped?.map((s) => s.status)).toEqual([404, 404]);
  });
});

describe("主要模型太慢或忙線時直接改用備用模型", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("主要模型逾時：記成 408 並改用備用模型", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes(GEMINI_MODELS[0])) throw new DOMException("timed out", "TimeoutError");
        return new Response(JSON.stringify(ok));
      }),
    );
    const call: GeminiCall = { apiKey: "k" };
    const f = await scoreSpeech(call, { base64: "", mimeType: "audio/webm" }, "hi", "en");
    expect(f.score).toBe(0.9);
    expect(call.skipped?.[0]).toMatchObject({ model: GEMINI_MODELS[0], status: 408 });
  });

  it("主要模型 503 不重試，直接換備用模型", async () => {
    const fetch = vi.fn(async (url: string) =>
      url.includes(GEMINI_MODELS[0]) ? new Response("{}", { status: 503 }) : new Response(JSON.stringify(ok)),
    );
    vi.stubGlobal("fetch", fetch);
    const call: GeminiCall = { apiKey: "k" };
    await scoreSpeech(call, { base64: "", mimeType: "audio/webm" }, "hi", "en");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(call.skipped).toEqual([{ model: GEMINI_MODELS[0], status: 503, reason: "{}" }]);
  });

  it("跳過思考段落，拿真正的答案", async () => {
    const answer = JSON.stringify({ heard: "hi", score: 0.7, tip: "", issues: [] });
    const body = { candidates: [{ content: { parts: [{ text: "thinking...", thought: true }, { text: answer }] } }] };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(body))),
    );
    const f = await scoreSpeech({ apiKey: "k" }, { base64: "", mimeType: "audio/webm" }, "hi", "en");
    expect(f.score).toBe(0.7);
  });
});

describe("思考調低", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("要求低思考；模型不支援時拿掉設定重送同一個模型", async () => {
    const bodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(String(init.body));
        return String(init.body).includes("thinkingLevel")
          ? new Response(JSON.stringify({ error: { message: 'Unknown name "thinkingLevel"' } }), { status: 400 })
          : new Response(JSON.stringify(ok));
      }),
    );
    const call: GeminiCall = { apiKey: "k" };
    const f = await scoreSpeech(call, { base64: "", mimeType: "audio/webm" }, "hi", "en");
    expect(f.score).toBe(0.9);
    expect(call.model).toBe(GEMINI_MODELS[0]);
    expect(bodies[0]).toContain('"thinkingLevel":"low"');
    expect(bodies[1]).not.toContain("thinking");
  });
});
