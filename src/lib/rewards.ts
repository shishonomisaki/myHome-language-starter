// 每日練習與獎勵：連續達成、累計時數、中斷保護卡、點數。全部只跟自己比。

import { addDays } from "./dates";
import type { DailyLog, RewardState } from "./types";

export const STREAK_MILESTONES = [3, 7, 30, 100, 365];
export const HOUR_MILESTONES = [10, 50, 100, 500, 1000];
export const MAX_FREEZE_CARDS = 2;
export const FREEZE_EVERY_DAYS = 7;

export const POINTS = {
  dailyGoal: 10,
  streakMilestone: 50,
  levelUp: 200,
};

export function goalMetDates(logs: DailyLog[], goalMinutes: number): Set<string> {
  const byDate = new Map<string, number>();
  for (const l of logs) byDate.set(l.date, (byDate.get(l.date) ?? 0) + l.minutes);
  const met = new Set<string>();
  for (const [date, minutes] of byDate) if (minutes >= goalMinutes) met.add(date);
  return met;
}

/**
 * 目前連續天數。今天還沒練完不算斷，從昨天往回數；用過保護卡的日期也算有練。
 */
export function currentStreak(
  metDates: Set<string>,
  frozenDates: string[],
  todayKey: string,
): number {
  const counted = new Set([...metDates, ...frozenDates]);
  let day = counted.has(todayKey) ? todayKey : addDays(todayKey, -1);
  let streak = 0;
  while (counted.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

export function totalHours(logs: DailyLog[]): number {
  return logs.reduce((sum, l) => sum + l.minutes, 0) / 60;
}

export function badgeId(kind: "streak" | "hours" | "level", value: number | string): string {
  return `${kind}:${value}`;
}

export function badgeLabel(id: string): string {
  const [kind, value] = id.split(":");
  if (kind === "streak") return `連續 ${value} 天`;
  if (kind === "hours") return `累計 ${value} 小時`;
  if (kind === "level") return `升級 ${value}`;
  return id;
}

/**
 * 今天達成目標時呼叫：加點數、發保護卡、補發新達成的徽章。
 * 回傳新的獎勵狀態與這次新拿到的徽章。
 */
export function onGoalMet(
  state: RewardState,
  streak: number,
  hours: number,
): { state: RewardState; newBadges: string[] } {
  const badges = new Set(state.badges);
  const newBadges: string[] = [];
  let points = state.points + POINTS.dailyGoal;

  for (const m of STREAK_MILESTONES) {
    const id = badgeId("streak", m);
    if (streak >= m && !badges.has(id)) {
      badges.add(id);
      newBadges.push(id);
      points += POINTS.streakMilestone;
    }
  }
  for (const m of HOUR_MILESTONES) {
    const id = badgeId("hours", m);
    if (hours >= m && !badges.has(id)) {
      badges.add(id);
      newBadges.push(id);
    }
  }

  let freezeCards = state.freezeCards;
  if (streak > 0 && streak % FREEZE_EVERY_DAYS === 0) {
    freezeCards = Math.min(MAX_FREEZE_CARDS, freezeCards + 1);
  }

  return { state: { ...state, points, freezeCards, badges: [...badges] }, newBadges };
}

/**
 * 昨天沒達成、但手上有保護卡時，自動用一張補昨天，連續天數不歸零。
 */
export function applyFreezeIfNeeded(
  state: RewardState,
  metDates: Set<string>,
  todayKey: string,
): RewardState {
  const yesterday = addDays(todayKey, -1);
  const dayBefore = addDays(todayKey, -2);
  const covered = (d: string) => metDates.has(d) || state.frozenDates.includes(d);
  if (covered(yesterday) || !covered(dayBefore) || state.freezeCards <= 0) return state;
  return {
    ...state,
    freezeCards: state.freezeCards - 1,
    frozenDates: [...state.frozenDates, yesterday],
  };
}

export function emptyRewards(learnerId: string): RewardState {
  return { learnerId, points: 0, freezeCards: 0, badges: [], frozenDates: [] };
}
