"use client";

// 全站浮動訊息：存檔成功／失敗都在畫面正下方跳出來，4 秒後自動消失，捲到哪裡都看得到。
import { useEffect, useState } from "react";

const EVENT = "app-toast";

/** 成功訊息，例如「已儲存：每日目標 30 分鐘」。 */
export function toastOk(text: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { text: `✅ ${text}`, ok: true } }));
}

/** 失敗訊息：沒存到時一定要讓人知道。 */
export function toastError(err: unknown) {
  const text = err instanceof Error ? err.message : String(err);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { text: `⚠️ 沒有存到：${text}`, ok: false } }));
}

export function Toaster() {
  const [t, setT] = useState<{ text: string; ok: boolean; id: number } | null>(null);
  useEffect(() => {
    const on = (e: Event) => setT({ ...(e as CustomEvent).detail, id: Date.now() });
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  useEffect(() => {
    if (!t) return;
    const h = setTimeout(() => setT(null), 4000);
    return () => clearTimeout(h);
  }, [t]);
  if (!t) return null;
  return (
    <p
      role="status"
      className={`fixed bottom-4 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-lg px-4 py-2 text-white shadow-lg ${t.ok ? "bg-teal-700" : "bg-red-700"}`}
    >
      {t.text}
    </p>
  );
}
