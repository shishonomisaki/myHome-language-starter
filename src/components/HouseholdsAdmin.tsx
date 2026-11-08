"use client";

// 超級管理員：家庭清單、各家本週練習分鐘、新增／改名家庭、把家人換到別的家庭、刪除家人。
import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { deleteMember, moveMember } from "./AddMember";
import { toastError, toastOk } from "./Toast";

export interface Household {
  id: string;
  name: string;
  tag: string;
  circle: string;
  hasBoardCode: boolean;
  weekMinutes: number;
  members: { id: string; nickname: string; avatar: string; role: string; weekMinutes: number }[];
}

async function call(method: "GET" | "POST", body?: unknown) {
  const { data } = await getSupabase().auth.getSession();
  const res = await fetch("/api/admin/households", {
    method,
    headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "失敗了");
  return json;
}

const ROLE: Record<string, string> = { admin: "超級管理員", family_admin: "家庭管理員", learner: "學習者" };
const input = "rounded-lg border border-black/15 bg-transparent px-2 py-1 dark:border-white/20";

export function HouseholdsAdmin({ onChanged }: { onChanged?: (list: Household[]) => void }) {
  const [list, setList] = useState<Household[] | null>(null);
  const [big, setBig] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ id: "", name: "", tag: "", circle: "親族" });

  const load = useCallback(async () => {
    try {
      const j = await call("GET");
      setList(j.households);
      setBig(!!j.bigFamily);
      onChanged?.(j.households);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }, [onChanged]);
  useEffect(() => {
    load();
  }, [load]);


  async function run(f: () => Promise<unknown>, ok: string) {
    setMsg("");
    try {
      await f();
      toastOk(ok.replace(/^✅ /, ""));
      await load();
    } catch (e) {
      toastError(e);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      {msg && <p>{msg}</p>}
      {!list && !msg && <p>載入中…</p>}
      {list && (
        <label className="flex items-center gap-2 rounded-lg bg-teal-50 p-2 dark:bg-teal-950">
          <input
            type="checkbox"
            checked={big}
            onChange={(e) => {
              const on = e.target.checked;
              run(() => call("POST", { action: "bigFamily", on }), on ? "大家庭模式已打開：每家的看板都看得到所有人" : "大家庭模式已關閉：各家看自己家");
            }}
          />
          🎉 大家庭模式（打開後，用任何一家的通關碼都看得到同一親族圈所有人的卡片；作業與作答細節仍只有自家看得到）
        </label>
      )}
      {list?.map((h) => (
        <div key={h.id} className="rounded-lg border border-black/10 p-3 dark:border-white/15">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">
              {h.name}
              {h.tag && <span className="ml-2 rounded bg-black/5 px-1.5 text-xs dark:bg-white/10">{h.tag}</span>}
              <span className="ml-2 text-xs text-black/50 dark:text-white/50">圈：{h.circle}{h.hasBoardCode ? "" : " · 還沒設看板通關碼"}</span>
            </span>
            <span className="flex items-center gap-2">
              本週 {h.weekMinutes} 分鐘
              <button type="button" className="btn-ghost" onClick={() => setForm({ id: h.id, name: h.name, tag: h.tag, circle: h.circle })}>
                改名稱
              </button>
            </span>
          </div>
          <ul className="mt-2 space-y-1">
            {h.members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2">
                <span>
                  {m.avatar} {m.nickname}
                </span>
                <span className="text-xs text-black/50 dark:text-white/50">本週 {m.weekMinutes} 分</span>
                <select className={input} value={m.role} onChange={(e) => run(() => moveMember(m.id, { role: e.target.value }), `✅ 已儲存：${m.nickname} 改成${ROLE[e.target.value]}`)}>
                  {Object.entries(ROLE).map(([v, t]) => (
                    <option key={v} value={v}>
                      {t}
                    </option>
                  ))}
                </select>
                <select className={input} value={h.id} onChange={(e) => run(() => moveMember(m.id, { householdId: e.target.value }), `✅ 已儲存：${m.nickname} 已換家庭`)}>
                  {list.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-ghost text-red-700 dark:text-red-400"
                  onClick={() => {
                    if (confirm(`確定要刪除「${m.nickname}」嗎？他的進度和作答會一起刪掉，不能復原。`))
                      run(() => deleteMember(m.id), `✅ 已刪除 ${m.nickname}`);
                  }}
                >
                  刪除
                </button>
              </li>
            ))}
            {h.members.length === 0 && <li className="text-black/50 dark:text-white/50">還沒有成員</li>}
          </ul>
        </div>
      ))}
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => call("POST", form), form.id ? "✅ 已儲存家庭資料" : "✅ 已新增家庭");
          setForm({ id: "", name: "", tag: "", circle: "親族" });
        }}
      >
        <input className={input} placeholder="家庭名稱" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className={input} placeholder="標記（選填）" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} />
        <input className={input} placeholder="親族圈" value={form.circle} onChange={(e) => setForm({ ...form, circle: e.target.value })} />
        <button type="submit" className="btn" disabled={!form.name}>
          {form.id ? "儲存" : "新增家庭"}
        </button>
        {form.id && (
          <button type="button" className="btn-ghost" onClick={() => setForm({ id: "", name: "", tag: "", circle: "親族" })}>
            取消
          </button>
        )}
      </form>
      <p className="text-xs text-black/50 dark:text-white/50">同一個親族圈的家庭，在看板上看得到彼此的概況（暱稱、連續天數、本週分鐘）；作答細節只有自家看得到。</p>
    </div>
  );
}
