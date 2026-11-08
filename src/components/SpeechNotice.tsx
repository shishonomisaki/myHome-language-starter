"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { forgetLastSpeech, SPEECH_PROBLEM_EVENT, stopSpeaking } from "@/lib/speech";

/**
 * 換頁就自動停止朗讀並清掉上一頁的內容；朗讀沒聲音時，在畫面上方說明原因與解法（例如裝置沒有日語語音）。
 * 發音控制圓鈕只放在有可朗讀內容的頁面（SpeakControls），沒有內容的頁面就沒有。
 */
export function SpeechNotice() {
  const [message, setMessage] = useState("");
  const path = usePathname();

  useEffect(() => {
    const on = (e: Event) => setMessage(String((e as CustomEvent).detail ?? ""));
    window.addEventListener(SPEECH_PROBLEM_EVENT, on);
    return () => window.removeEventListener(SPEECH_PROBLEM_EVENT, on);
  }, []);

  useEffect(() => {
    stopSpeaking();
    forgetLastSpeech();
  }, [path]);

  return (
    <>
      {message && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/50 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100"
        >
          <span aria-hidden>🔇</span>
          <p className="flex-1">{message}</p>
          <button type="button" className="shrink-0 underline" onClick={() => setMessage("")}>
            知道了
          </button>
        </div>
      )}
    </>
  );
}
