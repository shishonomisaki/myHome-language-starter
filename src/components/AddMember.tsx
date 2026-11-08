"use client";

import { useState } from "react";
import { FAMILY_EMAIL_DOMAIN } from "@/lib/account";
import { getSupabase } from "@/lib/supabase";
import { toastError, toastOk } from "./Toast";
import { DAILY_MINUTE_OPTIONS, type DailyMinutes } from "@/lib/types";

async function call(method: "POST" | "PATCH" | "DELETE", body: unknown) {
  const { data } = await getSupabase().auth.getSession();
  const res = await fetch("/api/admin/members", {
    method,
    headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "失敗了");
  return json;
}

export function resetPassword(id: string, password: string) {
  return call("PATCH", { id, password });
}

/** 超級管理員：換家庭或改角色。 */
export function moveMember(id: string, patch: { householdId?: string; role?: string }) {
  return call("PATCH", { id, ...patch });
}

/** 超級管理員：刪除家人（連同他的進度與作答）。 */
export function deleteMember(id: string) {
  return call("DELETE", { id });
}

/** 後台：新增家人帳號（孩子用帳號名稱登入，不用 email）。 */
export function AddMember({
  onAdded,
  isSuper = true,
  households = [],
}: {
  onAdded: () => void;
  /** 超級管理員可以選家庭、建超級管理員；家庭管理員只能建在自己家。 */
  isSuper?: boolean;
  households?: { id: string; name: string }[];
}) {
  const [f, setF] = useState({ account: "", password: "", nickname: "", avatar: "🙂", role: "learner", householdId: "", dailyMinutes: 15 as DailyMinutes });
  const [msg, setMsg] = useState("");
  const input = "rounded-lg border border-black/15 bg-transparent px-2 py-1 dark:border-white/20";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      await call("POST", f);
      setMsg(`已建立，登入帳號：${f.account}`);
      toastOk(`已建立帳號：${f.account}`);
      setF({ ...f, account: "", password: "", nickname: "" });
      onAdded();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
      toastError(err);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3 text-sm">
      <h2 className="text-base font-semibold">新增家人</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2">
          帳號
          <input className={`flex-1 ${input}`} value={f.account} onChange={(e) => setF({ ...f, account: e.target.value })} placeholder="例如 dabao" />
        </label>
        <label className="flex items-center gap-2">
          密碼
          <input className={`flex-1 ${input}`} type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="至少 8 個字" />
        </label>
        <label className="flex items-center gap-2">
          暱稱
          <input className={`flex-1 ${input}`} value={f.nickname} onChange={(e) => setF({ ...f, nickname: e.target.value })} />
        </label>
        <label className="flex items-center gap-2">
          頭像
          <input className={`w-16 ${input}`} value={f.avatar} onChange={(e) => setF({ ...f, avatar: e.target.value })} />
        </label>
        <label className="flex items-center gap-2">
          身分
          <select className={input} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="learner">學習者</option>
            <option value="family_admin">家庭管理員</option>
            {isSuper && <option value="admin">超級管理員</option>}
          </select>
        </label>
        {isSuper && households.length > 1 && (
          <label className="flex items-center gap-2">
            家庭
            <select className={input} value={f.householdId} onChange={(e) => setF({ ...f, householdId: e.target.value })}>
              <option value="">（和我同一家）</option>
              {households.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2">
          每日目標
          <select className={input} value={f.dailyMinutes} onChange={(e) => setF({ ...f, dailyMinutes: Number(e.target.value) as DailyMinutes })}>
            {DAILY_MINUTE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} 分鐘
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs text-black/50 dark:text-white/50">
        登入時只要打帳號；系統內部會記成「帳號@{FAMILY_EMAIL_DOMAIN}」，不會寄任何信。
      </p>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn" disabled={!f.account || !f.password || !f.nickname}>
          建立帳號
        </button>
        {msg && <span>{msg}</span>}
      </div>
    </form>
  );
}
