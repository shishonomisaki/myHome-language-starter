"use client";

import { useState } from "react";
import { loginEmail } from "@/lib/account";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

export default function LoginPage() {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!supabaseConfigured) return <p className="card">試用模式不用登入，直接回首頁選家人就可以。</p>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await getSupabase().auth.signInWithPassword({ email: loginEmail(account), password });
    setBusy(false);
    if (error) setError("帳號或密碼不對，再試一次");
  }

  return (
    <form onSubmit={submit} className="card mx-auto max-w-sm space-y-4">
      <h1 className="text-xl font-semibold">登入</h1>
      <label className="block space-y-1">
        <span className="text-sm">帳號</span>
        <input
          className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
          autoComplete="username"
          autoCapitalize="none"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm">密碼</span>
        <input
          type="password"
          className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      <button type="submit" className="btn w-full" disabled={busy || !account || !password}>
        {busy ? "登入中…" : "登入"}
      </button>
      <p className="text-xs text-black/50 dark:text-white/50">忘記密碼請找爸爸或媽媽在後台重設。</p>
    </form>
  );
}
