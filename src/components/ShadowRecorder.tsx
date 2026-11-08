"use client";

import { useEffect, useRef, useState } from "react";
import {
  canListen,
  canRecord,
  SILENT_PEAK,
  startRecording,
  type Recording,
  type RecordingSession,
} from "@/lib/speech";
import type { Language } from "@/lib/types";

/**
 * 跟讀錄音按鈕：按下開始，畫面顯示音量條和用到的麥克風，唸完按「唸完了」（最多 20 秒自動停）。
 * 錄音一律送去評分；音量幾乎是零時另外提醒換麥克風。
 */
export function ShadowRecorder({
  language,
  label,
  disabled,
  small,
  iconOnly,
  onRecorded,
}: {
  language: Language;
  label: string;
  disabled?: boolean;
  small?: boolean;
  /** 放進浮動朗讀列用：只剩一顆 🎤 圓鈕，錄音狀態與提示用小氣泡顯示在上方。 */
  iconOnly?: boolean;
  onRecorded: (rec: Recording) => Promise<void> | void;
}) {
  const [session, setSession] = useState<RecordingSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState(0);
  const [hint, setHint] = useState("");
  const live = useRef<RecordingSession | null>(null);

  useEffect(() => () => live.current?.stop(), []);

  if (!canRecord() && !canListen()) {
    if (iconOnly)
      return (
        <button type="button" disabled title="這個瀏覽器不能錄音，請用 Chrome" aria-label="這個瀏覽器不能錄音" className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 text-lg opacity-35 dark:border-white/15">
          🎤
        </button>
      );
    return (
      <p className="text-sm text-black/60 dark:text-white/60">
        這個瀏覽器不能錄音，請用電腦或手機的 Chrome。
      </p>
    );
  }

  async function start() {
    setHint("");
    setBusy(true);
    try {
      const s = await startRecording(language, { onLevel: setLevel });
      live.current = s;
      setSession(s);
      const rec = await s.done;
      live.current = null;
      setSession(null);
      // 音量偵測只當參考：照樣送去評分，真的很小聲才另外提醒換麥克風。
      if (rec.audio && !rec.heard && rec.peak >= 0 && rec.peak < SILENT_PEAK) {
        setHint(
          `麥克風幾乎沒收到聲音${rec.device ? `（目前用的是「${rec.device}」）` : ""}。如果分數也是 0，請點網址列左側的設定圖示，換成你正在用的麥克風再唸一次。`,
        );
      } else if (rec.problem && !rec.audio) setHint(rec.problem);
      await onRecorded(rec);
    } catch (e) {
      setHint(e instanceof Error ? e.message : String(e));
    } finally {
      live.current = null;
      setSession(null);
      setBusy(false);
    }
  }

  if (iconOnly) {
    const bubble = session
      ? `🎙 錄音中，唸完再按一次 ⏹`
      : busy
        ? "⏳ AI 評分中…"
        : hint;
    return (
      // 提示放在按鈕「左邊」且不佔排版：按鈕開始／停止都在同一個位置，也不會浮在上方蓋住句子。
      <div className="relative">
        <button
          type="button"
          aria-label={session ? "唸完了" : label}
          title={session ? "唸完了" : label}
          onClick={session ? () => session.stop() : start}
          disabled={!session && (disabled || busy)}
          className={`relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border text-lg shadow-sm transition active:scale-90 disabled:opacity-35 ${
            session ? "border-red-500 bg-red-50 dark:bg-red-950" : "border-black/10 bg-white dark:border-white/15 dark:bg-stone-900"
          }`}
        >
          {session && (
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 bg-red-400/40 transition-[height] duration-75"
              style={{ height: `${Math.round(level * 100)}%` }}
            />
          )}
          <span aria-hidden className="relative">{session ? "⏹" : busy ? "⏳" : "🎤"}</span>
        </button>
        {bubble && (
          <p
            role="status"
            className={`pointer-events-none absolute right-full top-1/2 mr-2 w-max max-w-[min(14rem,60vw)] -translate-y-1/2 rounded-lg border border-black/10 bg-white/95 px-2 py-1 text-xs leading-snug dark:border-white/15 dark:bg-stone-900/95 ${
              hint && !session && !busy ? "text-red-700 dark:text-red-400" : ""
            }`}
          >
            {bubble}
          </p>
        )}
      </div>
    );
  }

  const btn = small ? "btn-ghost text-sm" : "btn-ghost";
  return (
    <div className="space-y-1">
      {session ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={small ? "btn text-sm" : "btn"}
            onClick={() => session.stop()}
          >
            ⏹ 唸完了
          </button>
          <span
            className="h-2 w-28 overflow-hidden rounded bg-black/10 dark:bg-white/15"
            aria-label="音量"
          >
            <span
              className="block h-full bg-teal-600 transition-[width] duration-75"
              style={{ width: `${Math.round(level * 100)}%` }}
            />
          </span>
          <span className="text-xs text-black/50 dark:text-white/50">
            🎙 {session.device || "麥克風"}・錄音中，唸完按「唸完了」
          </span>
        </div>
      ) : (
        <button
          type="button"
          className={btn}
          onClick={start}
          disabled={disabled || busy}
        >
          {busy ? "⏳ AI 評分中，請稍候…" : label}
        </button>
      )}
      {hint && <p className="text-sm text-red-700 dark:text-red-400">{hint}</p>}
    </div>
  );
}
