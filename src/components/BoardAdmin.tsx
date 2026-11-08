"use client";

// 後台的家庭看板設定：通關碼、每週全家目標、思考題亮點（家長核准後才上看板）。

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import { toastError, toastOk } from "./Toast";

async function call(method: "GET" | "POST", body?: unknown, query = "") {
  const { data } = await getSupabase().auth.getSession();
  const res = await fetch(`/api/admin/board${query}`, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${data.session?.access_token ?? ""}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "失敗了");
  return json;
}

interface Ctx {
  featured: Set<string>;
  toggle: (
    learnerId: string,
    readingId: string,
    index: number,
  ) => Promise<void>;
}
const FeaturedCtx = createContext<Ctx | null>(null);

export function BoardAdminProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [featured, setFeatured] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!supabaseConfigured) return;
    call("GET")
      .then((j) => setFeatured(new Set(j.featured as string[])))
      .catch(() => {});
  }, []);
  const toggle = useCallback(
    async (learnerId: string, readingId: string, index: number) => {
      const key = `${learnerId}:${readingId}:${index}`;
      const on = !featured.has(key);
      await call("POST", {
        action: "feature",
        learnerId,
        readingId,
        index,
        on,
      });
      setFeatured((s) => {
        const n = new Set(s);
        if (on) n.add(key);
        else n.delete(key);
        return n;
      });
    },
    [featured],
  );
  return (
    <FeaturedCtx.Provider value={{ featured, toggle }}>
      {children}
    </FeaturedCtx.Provider>
  );
}

/** 思考題旁的「上看板」按鈕。 */
export function FeatureButton({
  learnerId,
  readingId,
  index,
}: {
  learnerId: string;
  readingId: string;
  index: number;
}) {
  const ctx = useContext(FeaturedCtx);
  const [error, setError] = useState("");
  if (!ctx || !supabaseConfigured) return null;
  const on = ctx.featured.has(`${learnerId}:${readingId}:${index}`);
  return (
    <span className="ml-2">
      <button
        type="button"
        className="text-xs text-teal-700 hover:underline dark:text-teal-400"
        onClick={() =>
          ctx.toggle(learnerId, readingId, index).then(
            () => {
              setError("");
              toastOk("已儲存：看板亮點");
            },
            (e) => {
              setError((e as Error).message);
              toastError(e);
            },
          )
        }
      >
        {on ? "⭐ 已上看板（點一下取消）" : "☆ 設為亮點上看板"}
      </button>
      {error && (
        <span className="ml-2 text-xs text-red-700 dark:text-red-400">
          {error}
        </span>
      )}
    </span>
  );
}

/** 通關碼與每週目標設定。 */
/** 超級管理員可以選要設定哪一個家庭；家庭管理員只會設自己家。 */
export function BoardSettings({ households = [] }: { households?: { id: string; name: string }[] }) {
  const [code, setCode] = useState("");
  const [goal, setGoal] = useState(300);
  const [msg, setMsg] = useState("");
  const [householdId, setHouseholdId] = useState("");
  const homeName = households.find((h) => h.id === householdId)?.name ?? "自己家";
  useEffect(() => {
    setMsg("");
    call("GET", undefined, householdId ? `?householdId=${encodeURIComponent(householdId)}` : "")
      .then((j) => {
        setCode(j.code as string);
        setGoal(j.weeklyGoal as number);
      })
      .catch((e) => setMsg((e as Error).message));
  }, [householdId]);
  return (
    <form
      className="space-y-2 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        call("POST", { action: "settings", code, weeklyGoal: goal, householdId: householdId || undefined }).then(
          () => {
            setMsg("已儲存");
            toastOk(`已儲存：${homeName}的看板通關碼與每週目標`);
          },
          (err) => {
            setMsg((err as Error).message);
            toastError(err);
          },
        );
      }}
    >
      <p className="text-black/60 dark:text-white/60">
        看板只顯示暱稱、題數、分鐘、正確率、連續天數，以及你設為亮點的思考題原文。知道通關碼的人都能看。
      </p>
      {households.length > 1 && (
        <label className="flex items-center gap-2">
          設定哪一家
          <select
            className="rounded-lg border border-black/15 bg-transparent px-2 py-1 dark:border-white/20"
            value={householdId}
            onChange={(e) => setHouseholdId(e.target.value)}
          >
            <option value="">（自己家）</option>
            {households.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex items-center gap-2">
        家庭通關碼
        <input
          className="flex-1 rounded-lg border border-black/15 bg-transparent px-2 py-1 dark:border-white/20"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="4 到 32 個字"
        />
      </label>
      <label className="flex items-center gap-2">
        全家每週目標（題）
        <input
          type="number"
          className="w-28 rounded-lg border border-black/15 bg-transparent px-2 py-1 dark:border-white/20"
          value={goal}
          onChange={(e) => setGoal(Number(e.target.value))}
        />
      </label>
      <button type="submit" className="btn">
        儲存
      </button>
      {msg && <span className="ml-2">{msg}</span>}
    </form>
  );
}
