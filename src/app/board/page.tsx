"use client";

import Link from "next/link";
import SiteGuide from "@/components/SiteGuide";
import { useCallback, useEffect, useState } from "react";
import type { Board } from "@/lib/board";

const CODE_KEY = "board-code";
const DATA_KEY = "board-data"; // 上次的看板結果，下次打開先直接顯示

function readCode(): string {
  try {
    return localStorage.getItem(CODE_KEY) ?? "";
  } catch {
    return "";
  }
}

export default function BoardPage() {
  const [code, setCode] = useState("");
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (c: string) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/board", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: c }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "讀取失敗");
      setBoard(json as Board);
      try {
        localStorage.setItem(CODE_KEY, c);
        localStorage.setItem(DATA_KEY, JSON.stringify(json));
      } catch {}
    } catch (e) {
      if ((e as Error).message === "通關碼不對") setBoard(null);
      setError((e as Error).message);
      if ((e as Error).message === "通關碼不對") {
        try {
          localStorage.removeItem(CODE_KEY);
          localStorage.removeItem(DATA_KEY);
        } catch {}
      }
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const saved = readCode();
    if (saved) {
      setCode(saved);
      try {
        const last = localStorage.getItem(DATA_KEY);
        if (last) setBoard(JSON.parse(last) as Board);
      } catch {}
      void load(saved);
    }
  }, [load]);

  if (!board) {
    return (
      <div className="space-y-6">
      <form
        className="card mx-auto max-w-sm space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void load(code.trim());
        }}
      >
        <h1 className="text-xl font-semibold">🏠 家庭看板</h1>
        <p className="text-sm text-black/60 dark:text-white/60">輸入家庭通關碼，就能看大家今天的練習。</p>
        <input
          className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="家庭通關碼"
          autoCapitalize="none"
        />
        {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
        <button type="submit" className="btn w-full" disabled={busy || code.trim().length < 4}>
          {busy ? "讀取中…" : "看看大家"}
        </button>
        <Link href="/login" className="block text-center text-sm text-teal-700 hover:underline dark:text-teal-400">
          要練習？登入 →
        </Link>
      </form>
      <SiteGuide open />
      </div>
    );
  }

  const f = board.family;
  const pct = Math.min(100, Math.round((f.weekCount / f.weekGoal) * 100));
  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">🏠 {board.householdName ?? "家庭"}看板</h1>
        <span className="flex gap-3 text-sm">
          <button type="button" className="text-teal-700 hover:underline dark:text-teal-400" onClick={() => load(code)} disabled={busy}>
            {busy ? "更新中…" : "重新整理"}
          </button>
          <Link href="/login" className="text-teal-700 hover:underline dark:text-teal-400">
            登入練習
          </Link>
        </span>
      </div>
      {board.computedAt && (
        <p className="-mt-4 text-xs text-gray-500 dark:text-gray-400">
          統計時間：{new Date(board.computedAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false })}（每天 0 點、12 點更新）
        </p>
      )}

      <section className="card space-y-2">
        <p className="font-medium">👨‍👩‍👦‍👦 全家本週一起做了 {f.weekCount} 題（目標 {f.weekGoal} 題）</p>
        <div className="h-3 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div className="h-full rounded-full bg-teal-600" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-sm text-black/60 dark:text-white/60">
          {pct >= 100 ? "🎉 本週目標達成！全家都很棒！" : `今天全家 ${f.todayCount} 題、${f.todayMinutes} 分鐘，再一起加油！`}
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {board.cards.map((c) => (
          <section key={c.id} className="card space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{c.avatar}</span>
              <div>
                <p className="font-medium">
                  {c.nickname}
                  {c.household && <span className="ml-2 text-xs font-normal text-black/50 dark:text-white/50">{c.household}</span>}
                </p>
                <p className="text-sm text-black/60 dark:text-white/60">🔥 連續 {c.streak} 天</p>
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <dt className="text-black/50 dark:text-white/50">今天題數</dt>
                <dd className="text-lg font-semibold">{c.todayCount}</dd>
              </div>
              <div>
                <dt className="text-black/50 dark:text-white/50">今日練習（分）</dt>
                <dd className="text-lg font-semibold">{c.todayMinutes}</dd>
              </div>
              <div>
                <dt className="text-black/50 dark:text-white/50">正確率</dt>
                <dd className="text-lg font-semibold">{c.todayAccuracy === null ? "—" : `${c.todayAccuracy}%`}</dd>
              </div>
            </dl>
            <p className="text-sm text-black/60 dark:text-white/60">
              完成 {c.doneToday} 項任務・本週 {c.weekMinutes} 分鐘・累計 {formatTotal(c.totalMinutes ?? 0)}
              {c.improvement !== null && `・正確率比上週進步 ${c.improvement} 分 📈`}
            </p>
            {c.stars.length > 0 ? (
              <p className="flex flex-wrap gap-1">
                {c.stars.map((s) => (
                  <span key={s} className="rounded-full bg-amber-100 px-2 py-0.5 text-sm text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                    {s}
                  </span>
                ))}
              </p>
            ) : (
              <p className="text-sm text-black/50 dark:text-white/50">今天還沒開始，等你喔 💪</p>
            )}
          </section>
        ))}
      </div>

      {board.highlights.length > 0 && (
        <section className="card space-y-3">
          <h2 className="font-semibold">💡 想法亮點：餐桌聊聊看</h2>
          {board.highlights.map((h, i) => (
            <div key={i} className="rounded-lg bg-black/5 p-3 dark:bg-white/5">
              <p className="text-xs text-black/60 dark:text-white/60">
                {h.title}：{h.question}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{h.answer}</p>
              <p className="mt-1 text-right text-sm">— {h.avatar} {h.nickname}</p>
            </div>
          ))}
        </section>
      )}

      {(board.circle?.length ?? 0) > 0 && (
        <section className="card space-y-3">
          <h2 className="font-semibold">👨‍👩‍👧‍👦 親族圈概況</h2>
          {board.circle!.map((h) => (
            <div key={h.household}>
              <p className="text-sm font-medium">{h.household}</p>
              <ul className="mt-1 flex flex-wrap gap-3 text-sm">
                {h.people.map((p, i) => (
                  <li key={i} className="rounded-lg bg-black/5 px-2 py-1 dark:bg-white/5">
                    {p.avatar} {p.nickname} · 連續 {p.streak} 天 · 本週 {Math.round(p.weekMinutes)} 分
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function formatTotal(min: number) {
  const h = Math.floor(min / 60);
  return h > 0 ? `${h} 小時 ${min % 60} 分` : `${min} 分鐘`;
}
