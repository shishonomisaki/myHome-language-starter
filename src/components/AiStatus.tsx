"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

interface Key {
  id: number;
  label: string;
  rotation_order: number;
  enabled: boolean;
  last_error: string | null;
}
interface Usage {
  key_id: number;
  date: string;
  calls: number;
  errors: number;
}
interface ModelUsage {
  date: string;
  model: string;
  calls: number;
  errors: number;
}
interface Skip {
  key_id: number;
  model: string;
  status: number;
  count: number;
  last_reason: string | null;
}
interface Settings {
  active_key_id: number | null;
  rotated_at: string | null;
  rotation_days: number;
}

const MODEL_NAMES: Record<string, string> = {
  "gemini-3.8-flash": "3.8 Flash（主要）",
  "gemini-3.5-flash-lite": "3.5 Flash-Lite（備用）",
};

const SKIP_STATUS: Record<number, string> = {
  404: "404 這把金鑰不能用這個模型",
  408: "逾時，改用備用模型",
  429: "429 額度不足",
  500: "500 Gemini 出錯",
  503: "503 Gemini 忙線",
};

/** Gemini 額度以 UTC 日期計算（台灣早上 8 點換日）。 */
const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);

/** 後台：每把金鑰今天用了多少、輪到誰、有沒有被標成額度用完，以及實際是哪個模型在回。 */
export function AiStatus() {
  const [data, setData] = useState<{
    keys: Key[];
    usage: Usage[];
    models: ModelUsage[];
    skips: Skip[];
    settings: Settings | null;
  } | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    const db = getSupabase();
    const since = utcDay(new Date(Date.now() - 6 * 86_400_000));
    const [keys, usage, models, settings, skips] = await Promise.all([
      db.from("ai_keys").select("id,label,rotation_order,enabled,last_error").order("rotation_order"),
      db.from("ai_usage").select("key_id,date,calls,errors").gte("date", since),
      db.from("ai_model_usage").select("date,model,calls,errors").gte("date", since),
      db.from("ai_settings").select("active_key_id,rotated_at,rotation_days").maybeSingle(),
      db.from("ai_model_skips").select("key_id,model,status,count,last_reason").eq("date", utcDay()),
    ]);
    const failed = keys.error ?? usage.error ?? models.error ?? settings.error;
    if (failed) return setError(failed.message);
    // 跳過紀錄是後來加的表，還沒建立時就當作沒有。
    setData({
      keys: keys.data ?? [],
      usage: usage.data ?? [],
      models: models.data ?? [],
      skips: skips.data ?? [],
      settings: settings.data,
    });
  }

  useEffect(() => {
    load();
  }, []);

  /** 改輪換天數或立刻換下一把；資料庫還沒更新時顯示原因。 */
  async function change(fn: "ai_set_rotation_days" | "ai_rotate_now", args?: Record<string, number>) {
    setNote("");
    const { error: failed } = await getSupabase().rpc(fn, args);
    if (failed) return setNote(`沒有改成：${failed.message}`);
    await load();
    setNote(fn === "ai_rotate_now" ? "已換到下一把。" : "已更新輪換天數。");
  }

  if (error) return <p className="text-sm text-red-700 dark:text-red-400">讀不到 AI 狀態：{error}</p>;
  if (!data) return <p className="text-sm">載入中…</p>;

  const today = utcDay();
  const sum = (rows: { calls: number; errors: number }[]) =>
    rows.reduce((t, r) => ({ calls: t.calls + r.calls, errors: t.errors + r.errors }), { calls: 0, errors: 0 });
  const { settings } = data;
  const nextRotation =
    settings?.rotated_at && new Date(Date.parse(settings.rotated_at) + settings.rotation_days * 86_400_000).toLocaleDateString("zh-TW");
  const modelNames = [...new Set([...Object.keys(MODEL_NAMES), ...data.models.map((m) => m.model)])];

  return (
    <div className="space-y-3 text-sm">
      <p>
        平常都用「使用中」那把，照天數輪換。那把這一分鐘太多人用或今天額度用完時，會自動改用下一把；全部都不能用才改用瀏覽器評分。
        {nextRotation && <>下次輪換：{nextRotation}。</>}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          輪換天數
          <select
            className="rounded border border-black/20 bg-white px-2 py-1 dark:border-white/20 dark:bg-neutral-900"
            value={settings?.rotation_days ?? 7}
            onChange={(e) => change("ai_set_rotation_days", { p_days: Number(e.target.value) })}
          >
            {[1, 3, 7, 14].map((d) => (
              <option key={d} value={d}>
                每 {d} 天
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-ghost text-sm" onClick={() => change("ai_rotate_now")}>
          立刻換下一把
        </button>
        {note && <span className="text-black/60 dark:text-white/60">{note}</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-black/60 dark:text-white/60">
            <tr>
              <th className="py-1 pr-3">金鑰</th>
              <th className="pr-3">狀態</th>
              <th className="pr-3">今天（呼叫／失敗）</th>
              <th>近 7 天</th>
            </tr>
          </thead>
          <tbody>
            {data.keys.map((k) => {
              const mine = data.usage.filter((u) => u.key_id === k.id);
              const t = sum(mine.filter((u) => u.date === today));
              const week = sum(mine);
              const active = settings?.active_key_id === k.id;
              const exhausted = k.last_error === `quota:${today}`;
              return (
                <tr key={k.id} className="border-t border-black/10 dark:border-white/10">
                  <td className="py-1 pr-3">
                    {k.label}
                    {active && <span className="ml-2 rounded bg-teal-700 px-1.5 text-xs text-white">使用中</span>}
                  </td>
                  <td className="pr-3">{!k.enabled ? "停用" : exhausted ? "🔴 今天額度用完" : active ? "🟢 正常" : "待命"}</td>
                  <td className="pr-3">
                    {t.calls}／{t.errors}
                  </td>
                  <td>
                    {week.calls}／{week.errors}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-black/60 dark:text-white/60">
            <tr>
              <th className="py-1 pr-3">模型</th>
              <th className="pr-3">今天（呼叫／失敗）</th>
              <th>近 7 天</th>
            </tr>
          </thead>
          <tbody>
            {modelNames.map((m) => {
              const rows = data.models.filter((r) => r.model === m);
              const t = sum(rows.filter((r) => r.date === today));
              const week = sum(rows);
              return (
                <tr key={m} className="border-t border-black/10 dark:border-white/10">
                  <td className="py-1 pr-3">{MODEL_NAMES[m] ?? m}</td>
                  <td className="pr-3">
                    {t.calls}／{t.errors}
                  </td>
                  <td>
                    {week.calls}／{week.errors}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {data.skips.length > 0 && (
        <div>
          <p className="font-medium">今天跳過的模型</p>
          <ul className="list-disc pl-5">
            {data.skips.map((s) => (
              <li key={`${s.key_id}-${s.model}-${s.status}`}>
                {data.keys.find((k) => k.id === s.key_id)?.label ?? `金鑰 ${s.key_id}`}：{MODEL_NAMES[s.model] ?? s.model} 跳過 {s.count}{" "}
                次（
                {SKIP_STATUS[s.status] ?? `錯誤 ${s.status}`}
                {s.last_reason && <span className="text-black/60 dark:text-white/60">，{s.last_reason}</span>}）
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-black/60 dark:text-white/60">
        「今天」以 UTC 日期計算（台灣早上 8 點換日，和 Gemini
        額度重置時間一致）。備用模型有呼叫次數，就代表主要模型額度用完後有正常切換。模型統計從這次更新後開始記錄。
      </p>
      <button type="button" className="btn-ghost text-sm" onClick={load}>
        重新整理
      </button>
    </div>
  );
}
