import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuotaError } from "../gemini";

const calls: { fn: string; args?: Record<string, unknown> }[] = [];
let usable: { data: unknown; error: unknown } = { data: [], error: null };

vi.mock("../supabase-server", () => ({
  serviceClient: () => ({
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === "ai_usable_keys") return usable;
      if (fn === "ai_active_key") return { data: [{ key_id: 1, api_key: "a" }], error: null };
      return { data: null, error: null };
    },
  }),
}));

const { withGeminiKey, BUSY_REASON, QUOTA_REASON } = await import("../ai-server");

const keys = [
  { key_id: 1, api_key: "a" },
  { key_id: 2, api_key: "b" },
];

describe("withGeminiKey 金鑰分流", () => {
  beforeEach(() => {
    calls.length = 0;
    usable = { data: keys, error: null };
  });

  it("輪到的那把忙線就改用下一把", async () => {
    const r = await withGeminiKey(async (call) => {
      if (call.apiKey === "a") throw new QuotaError("busy", false);
      return call.apiKey;
    });
    expect(r).toEqual({ ok: true, value: "b" });
    const usage = calls.filter((c) => c.fn === "ai_record_usage").map((c) => [c.args?.p_key, c.args?.p_ok, c.args?.p_quota]);
    expect(usage).toEqual([
      [1, false, false],
      [2, true, undefined],
    ]);
  });

  it("每日額度用完會標記那把，再換下一把", async () => {
    const r = await withGeminiKey(async (call) => {
      if (call.apiKey === "a") throw new QuotaError("daily", true);
      return call.apiKey;
    });
    expect(r).toEqual({ ok: true, value: "b" });
    expect(calls.find((c) => c.fn === "ai_record_usage")?.args?.p_quota).toBe(true);
  });

  it("全部忙線時說等一分鐘，全部用完時說額度用完", async () => {
    expect(await withGeminiKey(async () => Promise.reject(new QuotaError("busy", false)))).toEqual({ ok: false, reason: BUSY_REASON });
    expect(await withGeminiKey(async () => Promise.reject(new QuotaError("daily", true)))).toEqual({ ok: false, reason: QUOTA_REASON });
  });

  it("不是額度問題的錯誤不換金鑰", async () => {
    const tried: string[] = [];
    const r = await withGeminiKey(async (call) => {
      tried.push(call.apiKey);
      throw new Error("Gemini 400: bad");
    });
    expect(r).toEqual({ ok: false, reason: "AI 暫時沒回應（錯誤 400）" });
    expect(tried).toEqual(["a"]);
  });

  it("資料庫還沒更新時只用輪到的那把", async () => {
    usable = { data: null, error: { message: "missing" } };
    const r = await withGeminiKey(async (call) => call.apiKey);
    expect(r).toEqual({ ok: true, value: "a" });
  });
});
