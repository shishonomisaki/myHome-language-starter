"use client";

// 超級管理員：nlm 用量概況。數字是 Claude 每次批次自己記的帳，不含你直接在 nlm 網頁上的使用。
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

type Lv = "ok" | "warn" | "full";
interface Data {
  limits: { query: number; audio: number; sourcesPerNotebook: number; notebooks: number };
  today: { query: { used: number; level: Lv }; audio: { used: number; level: Lv }; blocked: boolean };
  notebooks: { id: string; title: string; sources: number; level: Lv }[];
  notebookCount: { used: number; level: Lv };
}

const COLOR: Record<Lv, string> = { ok: "bg-teal-600", warn: "bg-amber-500", full: "bg-red-600" };

function Bar({ label, used, limit, level }: { label: string; used: number; limit: number; level: Lv }) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span>
          {used} / {limit}
        </span>
      </div>
      <div className="h-2 rounded bg-black/10 dark:bg-white/10">
        <div className={`h-2 rounded ${COLOR[level]}`} style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
      </div>
    </div>
  );
}

export function NlmStatus() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    (async () => {
      const { data } = await getSupabase().auth.getSession();
      const res = await fetch("/api/admin/nlm", { headers: { authorization: `Bearer ${data.session?.access_token ?? ""}` } });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setErr(j.error ?? "讀取失敗");
      else setD(j);
    })();
  }, []);
  if (err) return <p className="text-sm">{err}</p>;
  if (!d) return <p className="text-sm">載入中…</p>;
  const nearFull = d.notebooks.filter((n) => n.level !== "ok");
  return (
    <div className="space-y-2 text-sm">
      {d.today.blocked && <p className="text-red-700 dark:text-red-400">今天有被 Google 擋下的紀錄，額度可能用完了。</p>}
      <Bar label="今天對話／出題" used={d.today.query.used} limit={d.limits.query} level={d.today.query.level} />
      <Bar label="今天音檔" used={d.today.audio.used} limit={d.limits.audio} level={d.today.audio.level} />
      <Bar label="筆記本數" used={d.notebookCount.used} limit={d.limits.notebooks} level={d.notebookCount.level} />
      {nearFull.length > 0 && (
        <p className="text-amber-700 dark:text-amber-400">
          快滿的筆記本：{nearFull.map((n) => `${n.title}（${n.sources}/${d.limits.sourcesPerNotebook}）`).join("、")}，Claude 會先通知你再清出空間。
        </p>
      )}
      <p className="text-xs text-black/50 dark:text-white/50">上限是大約值；Google 不提供剩餘額度，這裡只算 Claude 跑的批次。</p>
    </div>
  );
}
