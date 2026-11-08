/** 答對數不可能超過題數，也不會小於 0。 */
export function clampCorrect(correct: number, total: number): number {
  return Math.max(0, Math.min(correct, total));
}

/** 同一題只留第一次作答（只有第一次答對才算對）。 */
export function firstAttempts<T extends { itemId: string }>(attempts: T[]): T[] {
  const seen = new Set<string>();
  return attempts.filter((a) => (seen.has(a.itemId) ? false : (seen.add(a.itemId), true)));
}
