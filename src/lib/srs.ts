// 間隔重複：答對就把間隔拉長（1、2、4、7、14、30、60 天），答錯明天再來。
// 規格書「弱點補強的規則」與「五十音學過不忘」都靠這裡。

import { addDays } from "./dates";
import type { CardState } from "./types";

export const INTERVALS = [1, 2, 4, 7, 14, 30, 60];

/** 連續答對幾次算「學會」，不再當新卡。 */
export const MASTERED_STREAK = 3;

export function newCard(learnerId: string, itemId: string, todayKey: string): CardState {
  return { learnerId, itemId, streak: 0, due: todayKey, lapses: 0 };
}

export function review(card: CardState, correct: boolean, todayKey: string): CardState {
  if (!correct) {
    return {
      ...card,
      streak: 0,
      lapses: card.lapses + 1,
      due: addDays(todayKey, 1),
      lastReviewed: todayKey,
    };
  }
  const interval = INTERVALS[Math.min(card.streak, INTERVALS.length - 1)];
  return {
    ...card,
    streak: card.streak + 1,
    due: addDays(todayKey, interval),
    lastReviewed: todayKey,
  };
}

export function isDue(card: CardState, todayKey: string): boolean {
  return card.due <= todayKey;
}

export function isMastered(card: CardState): boolean {
  return card.streak >= MASTERED_STREAK;
}
