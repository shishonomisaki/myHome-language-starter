"use client";

import { useEffect, useState, type ReactNode } from "react";
import { changeSpeed, nextSentenceStart, pauseSpeaking, resumeSpeaking, SPEAKING_EVENT, skipToNext, speakState, type SpeakState } from "@/lib/speech";
import { SPEED_RATE, useSpeed, type SpeedPlace } from "@/lib/speech-speed";

/**
 * 全站唯一的發音控制：右下角一顆 🔊 圓鈕，點開變成一排小圖示。
 *   ▶／⏸  沒在唸 → 從頭唸；唸中 → 暫停；暫停 → 從停住的地方繼續
 *   ⏭     點了句子單獨唸之後，接著唸下一句、並把剩下的唸完（只有長文有）
 *   🐢🚶🐇 語速，每個地方（place）各記各的；🐇 要後台替這位家人打開才有
 *   extra 例如 🎤 唸唸看
 * 一開始唸（不管是點字、點句子或按 ▶）圓鈕會自己展開；頁面上沒有可朗讀的內容就不要放這個元件。
 */
export function SpeakControls({
  onPlay,
  place = "general",
  playLabel = "播放",
  sequence = false,
  extra,
}: {
  /** 從頭唸；rate 是這個地方目前選的語速。 */
  onPlay: (rate: number) => void;
  place?: SpeedPlace;
  playLabel?: string;
  /** 長文：多一個「下一句」。 */
  sequence?: boolean;
  /** 額外放在列尾的按鈕，例如「唸唸看」的 🎤。 */
  extra?: ReactNode;
}) {
  const state = useSpeakState();
  const speed = useSpeed(place);
  const [open, setOpen] = useState(false);
  // 開始唸就自動展開；唸完不會自己收起來，要用 ✕。
  useEffect(() => {
    if (state !== "idle") setOpen(true);
  }, [state]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="朗讀控制"
        title="朗讀控制"
        className="fixed bottom-4 dock-right z-40 flex h-12 w-12 items-center justify-center rounded-full border border-teal-600/40 bg-teal-700 text-xl text-white shadow-lg active:scale-95"
      >
        <span aria-hidden>🔊</span>
      </button>
    );
  }

  const main =
    state === "speaking"
      ? { icon: "⏸", label: "暫停", act: pauseSpeaking }
      : state === "paused"
        ? { icon: "▶", label: "繼續", act: resumeSpeaking }
        : { icon: "▶", label: playLabel, act: () => onPlay(speed.rate) };
  const canNext = sequence && nextSentenceStart() !== null;

  return (
    <div
      role="group"
      aria-label="發音控制"
      className="fixed bottom-4 dock-right z-40 flex items-center gap-1 rounded-full border border-teal-600/40 bg-white p-1 shadow-lg dark:border-teal-400/30 dark:bg-stone-900"
    >
      <TrayButton onClick={main.act} icon={main.icon} label={main.label} strong />
      {sequence && <TrayButton onClick={skipToNext} icon="⏭" label="下一句，接著唸完剩下的" disabled={!canNext} />}
      <TrayButton
        onClick={() => changeSpeed(SPEED_RATE[speed.cycle()])}
        icon={speed.icon}
        label={`語速：${speed.name}（按一下換）`}
      />
      {extra}
      <TrayButton onClick={() => setOpen(false)} icon="✕" label="收起" />
    </div>
  );
}

function TrayButton({
  onClick,
  icon,
  label,
  disabled = false,
  strong = false,
}: {
  onClick: () => void;
  icon: string;
  label: string;
  disabled?: boolean;
  strong?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-10 w-10 items-center justify-center rounded-full text-lg transition active:scale-90 disabled:cursor-not-allowed disabled:opacity-35 ${
        strong ? "bg-teal-700 text-white" : "hover:bg-black/5 dark:hover:bg-white/10"
      }`}
    >
      <span aria-hidden>{icon}</span>
    </button>
  );
}

/** 目前朗讀狀態（沒在唸／唸中／暫停）。 */
export function useSpeakState() {
  const [state, setState] = useState<SpeakState>("idle");
  useEffect(() => {
    setState(speakState());
    const on = (e: Event) => setState((e as CustomEvent<SpeakState>).detail);
    window.addEventListener(SPEAKING_EVENT, on);
    return () => window.removeEventListener(SPEAKING_EVENT, on);
  }, []);
  return state;
}

/** 頁面裡一句一句各放一顆的 🔊：點了就用這個地方的語速唸，浮動的圓鈕會自動展開讓你暫停、換速。 */
export function SayButton({ onPlay, place = "general", label = "聽" }: { onPlay: (rate: number) => void; place?: SpeedPlace; label?: string }) {
  const { rate } = useSpeed(place);
  return (
    <button
      type="button"
      onClick={() => onPlay(rate)}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-teal-600/40 bg-teal-50 text-lg shadow-sm active:scale-90 dark:border-teal-400/30 dark:bg-teal-950/60"
    >
      <span aria-hidden>🔊</span>
    </button>
  );
}

/** 放在頁面裡的語速鈕（輪流 🐢🚶🐇），正在唸就用新速度接著唸。 */
export function SpeedButton({ place = "general", withName = false, className = "" }: { place?: SpeedPlace; withName?: boolean; className?: string }) {
  const speed = useSpeed(place);
  return (
    <button
      type="button"
      onClick={() => changeSpeed(SPEED_RATE[speed.cycle()])}
      aria-label={`語速：${speed.name}（按一下換）`}
      title={`語速：${speed.name}（按一下換）`}
      className={`flex h-10 items-center justify-center gap-1 rounded-full border border-black/15 px-3 text-lg active:scale-95 dark:border-white/20 ${className}`}
    >
      <span aria-hidden>{speed.icon}</span>
      {withName && <span className="text-sm">{speed.name}</span>}
    </button>
  );
}
