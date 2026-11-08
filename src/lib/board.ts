// 家庭看板的統計與「今日之星」：只和自己比為主，星星有好幾種，讓每個人都有機會。

import { addDays } from "./dates";
import { currentStreak, goalMetDates } from "./rewards";

export interface BoardInput {
  id: string;
  nickname: string;
  avatar: string;
  dailyMinutes: number;
  frozenDates: string[];
  /** 最近 21 天每日分鐘數。 */
  logs: { date: string; minutes: number }[];
  /** 最近 14 天每天作答數與答對數（台灣日期）。 */
  attempts: { date: string; total: number; correct: number }[];
  doneToday: number;
}

export interface BoardCard {
  id: string;
  /** 大家庭模式時顯示是哪一家。 */
  household?: string;
  nickname: string;
  avatar: string;
  todayCount: number;
  todayMinutes: number;
  todayAccuracy: number | null;
  doneToday: number;
  goalMet: boolean;
  streak: number;
  weekMinutes: number;
  /** 從開始到現在的累計練習分鐘。 */
  totalMinutes?: number;
  /** 最近 7 天正確率比前 7 天進步幾個百分點；兩邊題數都夠才算，只顯示進步。 */
  improvement: number | null;
  stars: string[];
}

export interface Highlight {
  nickname: string;
  avatar: string;
  title: string;
  question: string;
  answer: string;
  at: string;
}

export interface Board {
  today: string;
  cards: BoardCard[];
  family: { weekCount: number; weekGoal: number; todayCount: number; todayMinutes: number };
  highlights: Highlight[];
  /** 統計快取的時間（每天 0 點、12 點）。 */
  computedAt?: string;
  /** 看板屬於哪個家庭。 */
  householdName?: string;
  /** 同一個親族圈裡其他家庭的概況（只有暱稱、連續天數、本週分鐘）。 */
  circle?: { household: string; people: { nickname: string; avatar: string; streak: number; weekMinutes: number }[] }[];
}

const MIN_FOR_ACCURACY = 10;

type Day = { total: number; correct: number };
const count = (list: Day[]) => list.reduce((s, d) => s + d.total, 0);

function accuracy(list: Day[]): number | null {
  const total = count(list);
  if (total < MIN_FOR_ACCURACY) return null;
  return Math.round((list.reduce((s, d) => s + d.correct, 0) / total) * 100);
}

export function weekCount(p: BoardInput, today: string): number {
  const start = addDays(today, -6);
  return count(p.attempts.filter((a) => a.date >= start));
}

export function buildCards(people: BoardInput[], today: string): BoardCard[] {
  const weekStart = addDays(today, -6);
  const prevStart = addDays(today, -13);
  const cards: BoardCard[] = people.map((p) => {
    const todayAtt = p.attempts.filter((a) => a.date === today);
    const thisWeek = p.attempts.filter((a) => a.date >= weekStart);
    const lastWeek = p.attempts.filter((a) => a.date >= prevStart && a.date < weekStart);
    const a1 = accuracy(thisWeek);
    const a0 = accuracy(lastWeek);
    const todayMinutes = p.logs.filter((l) => l.date === today).reduce((s, l) => s + l.minutes, 0);
    return {
      id: p.id,
      nickname: p.nickname,
      avatar: p.avatar,
      todayCount: count(todayAtt),
      todayMinutes: Math.round(todayMinutes),
      todayAccuracy: accuracy(todayAtt),
      doneToday: p.doneToday,
      goalMet: todayMinutes >= p.dailyMinutes,
      streak: currentStreak(goalMetDates(p.logs.map((l) => ({ ...l, learnerId: p.id })), p.dailyMinutes), p.frozenDates, today),
      weekMinutes: Math.round(p.logs.filter((l) => l.date >= weekStart).reduce((s, l) => s + l.minutes, 0)),
      improvement: a1 !== null && a0 !== null && a1 > a0 ? a1 - a0 : null,
      stars: [],
    };
  });
  awardStars(cards);
  return cards;
}

/** 頒今日之星（可並列，不排總分）。 */
export function awardStars(cards: BoardCard[]) {
  award(cards, "⏱️ 最努力", (c) => c.todayMinutes);
  award(cards, "🔥 最有恆心", (c) => c.streak);
  award(cards, "📈 進步最多", (c) => c.improvement ?? 0);
  award(cards, "🎯 最準", (c) => c.todayAccuracy ?? 0);
  for (const c of cards) if (c.goalMet) c.stars.push("✅ 今天達標");
}

/** 最高分的人（可並列）拿星星；大家都是 0 就不頒。 */
function award(cards: BoardCard[], star: string, value: (c: BoardCard) => number) {
  const best = Math.max(0, ...cards.map(value));
  if (best <= 0) return;
  for (const c of cards) if (value(c) === best) c.stars.push(star);
}

/** 台灣日期（伺服器在 UTC）。 */
export function taipeiDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(d);
}
