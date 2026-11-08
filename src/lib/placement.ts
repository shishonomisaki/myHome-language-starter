// 分級測驗：題目難度隨答題調整（階梯法）。
// 同一級連對 2 題就往上，答錯就往下；最後取「答對率 ≥ 70% 且至少答 2 題」的最高級。

import type { Level } from "./types";

export interface PlacementState {
  current: Level;
  maxLevel: Level;
  asked: number;
  maxQuestions: number;
  correctRun: number;
  /** 各級答題紀錄：[答對, 總數] */
  record: Partial<Record<Level, [number, number]>>;
  done: boolean;
}

export function startPlacement(start: Level, maxLevel: Level, maxQuestions = 12): PlacementState {
  return {
    current: Math.min(start, maxLevel) as Level,
    maxLevel,
    asked: 0,
    maxQuestions,
    correctRun: 0,
    record: {},
    done: false,
  };
}

export function answerPlacement(s: PlacementState, correct: boolean): PlacementState {
  const [c, t] = s.record[s.current] ?? [0, 0];
  const record = { ...s.record, [s.current]: [c + (correct ? 1 : 0), t + 1] as [number, number] };
  let current = s.current;
  let correctRun = correct ? s.correctRun + 1 : 0;

  if (correct && correctRun >= 2 && current < s.maxLevel) {
    current = (current + 1) as Level;
    correctRun = 0;
  } else if (!correct && current > 0) {
    current = (current - 1) as Level;
  }

  const asked = s.asked + 1;
  const reachedTop = current === s.maxLevel && (record[current]?.[0] ?? 0) >= 2;
  return {
    ...s,
    current,
    correctRun,
    record,
    asked,
    done: asked >= s.maxQuestions || reachedTop,
  };
}

export function placementResult(s: PlacementState): Level {
  let best: Level = 0;
  for (const [lvl, [c, t]] of Object.entries(s.record) as [string, [number, number]][]) {
    const level = Number(lvl) as Level;
    if (t >= 2 && c / t >= 0.7 && level > best) best = level;
  }
  return best;
}
