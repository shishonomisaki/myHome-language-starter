"use client";

import { useCallback, useEffect, useState } from "react";
import { SLOW_RATE } from "@/lib/speech";

/**
 * 朗讀語速：🐢 慢速、🚶 一般、🐇 快速三段輪流。
 * 每個「地方」各記各的（單字卡、短文、跟讀、聽力…），不是全站共用一個；按了才換，不會自己變。
 * 🐇 只有後台替這位家人打開「快速朗讀」才會出現。
 */
export type SpeedLevel = "slow" | "normal" | "fast";
export type SpeedPlace = "read" | "shadow" | "cards" | "listen" | "general";

// 🐇 快速 = 母語人士自在聊天的速度（比語音引擎的原速 1.0 再快一點）；一般稍慢，方便跟著唸。
export const SPEED_RATE: Record<SpeedLevel, number> = { slow: SLOW_RATE, normal: 0.85, fast: 1.15 };
export const SPEED_ICON: Record<SpeedLevel, string> = { slow: "🐢", normal: "🚶", fast: "🐇" };
export const SPEED_NAME: Record<SpeedLevel, string> = { slow: "慢速", normal: "一般", fast: "快速" };

/** 單字卡一開始就用慢速，其他地方一般速度。 */
export const DEFAULT_SPEED: Record<SpeedPlace, SpeedLevel> = {
  read: "normal",
  shadow: "normal",
  cards: "slow",
  listen: "normal",
  general: "normal",
};

const KEY = "speech-speed";
export const SPEED_EVENT = "speech-speed-changed";

let fastAllowed = false;

/** 登入的家人有沒有被後台開啟快速朗讀（登入資料讀到時設定）。 */
export function setFastAllowed(on: boolean) {
  if (fastAllowed === on) return;
  fastAllowed = on;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(SPEED_EVENT));
}

export function isFastAllowed() {
  return fastAllowed;
}

/** 這個人可以用的語速，由慢到快。 */
export function speedOrder(allowFast: boolean): SpeedLevel[] {
  return allowFast ? ["slow", "normal", "fast"] : ["slow", "normal"];
}

/** 按一下換到下一段：慢 → 一般 →（有開才有）快 → 回到慢。 */
export function nextSpeed(level: SpeedLevel, allowFast: boolean): SpeedLevel {
  const order = speedOrder(allowFast);
  const i = order.indexOf(level);
  return order[(i + 1) % order.length] ?? "normal";
}

/** 存著的是快速但這個人沒有快速可用（後台關掉了），退回一般。 */
export function usableSpeed(level: SpeedLevel, allowFast: boolean): SpeedLevel {
  return level === "fast" && !allowFast ? "normal" : level;
}

function readAll(): Partial<Record<SpeedPlace, SpeedLevel>> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function loadSpeed(place: SpeedPlace): SpeedLevel {
  const saved = readAll()[place];
  const level = saved === "slow" || saved === "normal" || saved === "fast" ? saved : DEFAULT_SPEED[place];
  return usableSpeed(level, fastAllowed);
}

export function saveSpeed(place: SpeedPlace, level: SpeedLevel) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [place]: level }));
  } catch {
    // 存不了就只有這次有效。
  }
  window.dispatchEvent(new CustomEvent(SPEED_EVENT));
}

/** 不在 React 裡（例如點字直接唸）取這個地方目前的語速。 */
export function rateFor(place: SpeedPlace): number {
  return SPEED_RATE[loadSpeed(place)];
}

/** 這個地方目前的語速；cycle() 換下一段、記住，並回傳新的語速。 */
export function useSpeed(place: SpeedPlace) {
  const [level, setLevel] = useState<SpeedLevel>(DEFAULT_SPEED[place]);
  const [allowFast, setAllowFast] = useState(false);
  useEffect(() => {
    const sync = () => {
      setLevel(loadSpeed(place));
      setAllowFast(isFastAllowed());
    };
    sync();
    window.addEventListener(SPEED_EVENT, sync);
    return () => window.removeEventListener(SPEED_EVENT, sync);
  }, [place]);
  const cycle = useCallback(() => {
    const next = nextSpeed(loadSpeed(place), isFastAllowed());
    saveSpeed(place, next);
    return next;
  }, [place]);
  return { level, rate: SPEED_RATE[level], icon: SPEED_ICON[level], name: SPEED_NAME[level], allowFast, cycle };
}
