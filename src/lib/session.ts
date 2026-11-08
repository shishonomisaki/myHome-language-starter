// 練習結束時的共同收尾：存卡片與作答、記分鐘、更新連續天數與獎勵。

import { today } from "./dates";
import { currentTaskKey } from "./done-tasks";
import type { Repo } from "./repo";
import { applyFreezeIfNeeded, currentStreak, goalMetDates, onGoalMet, totalHours } from "./rewards";
import type { Attempt, CardState } from "./types";

/** 練習計時：兩次作答間隔超過 2 分鐘就不算（離開去做別的事）。 */
export class PracticeTimer {
  private last = Date.now();
  private ms = 0;
  tick() {
    const now = Date.now();
    this.ms += Math.min(now - this.last, 120_000);
    this.last = now;
  }
  minutes() {
    return this.ms / 60_000;
  }
}

export async function finishSession(
  repo: Repo,
  learnerId: string,
  cards: CardState[],
  attempts: Attempt[],
  minutes: number,
): Promise<{ goalJustMet: boolean; newBadges: string[]; streak: number }> {
  const learner = await repo.getLearner(learnerId);
  if (!learner) throw new Error("找不到這位家人");
  const day = today();

  if (cards.length) await repo.saveCards(cards);
  if (attempts.length) await repo.addAttempts(attempts);

  const before = goalMetDates(await repo.getLogs(learnerId), learner.dailyMinutes);
  await repo.addMinutes(learnerId, day, minutes);
  const logs = await repo.getLogs(learnerId);
  const after = goalMetDates(logs, learner.dailyMinutes);

  let rewards = applyFreezeIfNeeded(await repo.getRewards(learnerId), after, day);
  const streak = currentStreak(after, rewards.frozenDates, day);
  let newBadges: string[] = [];
  const goalJustMet = !before.has(day) && after.has(day);
  if (goalJustMet) {
    const r = onGoalMet(rewards, streak, totalHours(logs));
    rewards = r.state;
    newBadges = r.newBadges;
  }
  await repo.saveRewards(rewards);
  const key = currentTaskKey();
  // 記錄失敗（例如資料表還沒建）不能讓練習收尾失敗。
  if (key) await repo.markTaskDone(learnerId, day, key).catch(() => {});
  return { goalJustMet, newBadges, streak };
}
