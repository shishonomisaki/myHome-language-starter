// 升級機制：英、日分開，每項技能各自升級。
// 1. 累積資格：最近 14 天、本級（含以上）作答 ≥ 40 題、正確率 > 95%、分散在 ≥ 5 天。
//    看中文提示才答對的本來就記成答錯。口說只算 AI 老師（Gemini）評分，瀏覽器評分不算：最近 10 句至少 8 句綠燈。
// 2. 升級小考：考下一級 15 題，正確率 ≥ 90% 才升級；沒過 3 天後再考。
// 3. 降級不自動：連續 14 天正確率 < 50% 只提醒管理者。管理者可在後台手動調整級別。

import { itemById, READINGS } from "@/content";
import { bankAttemptLevel } from "./bank-quiz";
import type { Attempt, Language, Level, Skill, SkillLevels } from "./types";

export const LEVELUP = {
  windowDays: 14,
  minAttempts: 40,
  minAccuracy: 0.95, // 要「大於」
  minDays: 5,
  speakingRecent: 10,
  speakingGreen: 8,
  quizQuestions: 15,
  quizPass: 0.9,
  retryDays: 3,
  weakAccuracy: 0.5,
  weakMinAttempts: 20,
} as const;

/** 可以考升級的技能；文法、聽力用題庫（NotebookLM 產出）的分級題。 */
export const LEVELUP_SKILLS: Skill[] = ["vocab", "grammar", "reading", "listening", "speaking"];

/** 升級小考結果存成一筆作答，itemId 用這個前綴，不會算進一般正確率。 */
export const QUIZ_PREFIX = "levelup-quiz:";
/** AI 評分的跟讀，每句一筆作答。 */
export const SPEAK_PREFIX = "speak:";

const READING_LEVEL = new Map(READINGS.map((r) => [r.id, r.level]));

/** 這筆作答屬於第幾級；查不到（作業、題庫題等）回傳 undefined，不列入升級計算。 */
export function attemptLevel(a: Attempt): Level | undefined {
  let id = a.itemId;
  if (id.startsWith(QUIZ_PREFIX)) return undefined;
  if (id.startsWith("bank:")) return bankAttemptLevel(id);
  if (id.startsWith(SPEAK_PREFIX)) id = id.slice(SPEAK_PREFIX.length).split("#")[0];
  return itemById(id)?.level ?? READING_LEVEL.get(id);
}

export function speakAttemptId(readingId: string, sentence: number): string {
  return `${SPEAK_PREFIX}${readingId}#${sentence}`;
}

export function quizAttemptId(skill: Skill, toLevel: Level): string {
  return `${QUIZ_PREFIX}${skill}:${toLevel}`;
}

export interface LevelUpStatus {
  skill: Skill;
  level: Level;
  eligible: boolean;
  /** 一般技能：題數、正確率、天數；口說：最近幾句、綠燈幾句。 */
  count: number;
  correct: number;
  days: number;
  /** 小考沒過要等到這天（含）之後。 */
  retryAfter?: string;
  /** 一句話說明還差什麼。 */
  note: string;
}

const dayOf = (iso: string) => iso.slice(0, 10);

export function levelUpStatus(
  attempts: Attempt[],
  language: Language,
  skill: Skill,
  level: Level,
  now: Date = new Date(),
): LevelUpStatus {
  const since = new Date(now.getTime() - LEVELUP.windowDays * 86_400_000).toISOString();
  const mine = attempts.filter((a) => a.language === language && a.skill === skill);
  const base = { skill, level, count: 0, correct: 0, days: 0 };

  if (level >= 6) return { ...base, eligible: false, note: "已經是最高級" };

  // 小考冷卻：最近一次沒過的小考。
  const lastFail = mine
    .filter((a) => a.itemId.startsWith(QUIZ_PREFIX) && !a.correct && a.itemId.endsWith(`:${level + 1}`))
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  const retryAfter = lastFail
    ? new Date(new Date(lastFail.at).getTime() + LEVELUP.retryDays * 86_400_000).toISOString()
    : undefined;
  const cooling = retryAfter !== undefined && retryAfter > now.toISOString();

  const atLevel = mine.filter((a) => {
    const l = attemptLevel(a);
    return l !== undefined && l >= level;
  });

  if (skill === "speaking") {
    const recent = atLevel
      .filter((a) => a.itemId.startsWith(SPEAK_PREFIX))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, LEVELUP.speakingRecent);
    const green = recent.filter((a) => a.correct).length;
    const ok = recent.length >= LEVELUP.speakingRecent && green >= LEVELUP.speakingGreen;
    return {
      ...base,
      count: recent.length,
      correct: green,
      days: new Set(recent.map((a) => dayOf(a.at))).size,
      eligible: ok && !cooling,
      retryAfter: cooling ? retryAfter : undefined,
      note: cooling
        ? `小考沒過，${dayOf(retryAfter!)} 後可再挑戰`
        : ok
          ? "可以挑戰升級了"
          : `AI 老師評分的最近 ${LEVELUP.speakingRecent} 句要有 ${LEVELUP.speakingGreen} 句綠燈（目前 ${green}/${recent.length}）`,
    };
  }

  const win = atLevel.filter((a) => a.at >= since);
  const correct = win.filter((a) => a.correct).length;
  const days = new Set(win.map((a) => dayOf(a.at))).size;
  const acc = win.length ? correct / win.length : 0;
  const lacks: string[] = [];
  if (win.length < LEVELUP.minAttempts) lacks.push(`再答 ${LEVELUP.minAttempts - win.length} 題`);
  if (!(acc > LEVELUP.minAccuracy)) lacks.push(`正確率要超過 95%（目前 ${Math.round(acc * 100)}%）`);
  if (days < LEVELUP.minDays) lacks.push(`再練 ${LEVELUP.minDays - days} 天`);
  const ok = lacks.length === 0;
  return {
    ...base,
    count: win.length,
    correct,
    days,
    eligible: ok && !cooling,
    retryAfter: cooling ? retryAfter : undefined,
    note: cooling ? `小考沒過，${dayOf(retryAfter!)} 後可再挑戰` : ok ? "可以挑戰升級了" : lacks.join("、"),
  };
}

export function allLevelUpStatus(attempts: Attempt[], language: Language, levels: SkillLevels, now?: Date): LevelUpStatus[] {
  return LEVELUP_SKILLS.map((s) => levelUpStatus(attempts, language, s, levels[s], now));
}

/** 小考是否通過。 */
export function quizPassed(correct: number, total: number): boolean {
  return total >= LEVELUP.quizQuestions && correct / total >= LEVELUP.quizPass;
}

/** 降級提醒（給管理者看）：最近 14 天本級作答夠多、正確率 < 50% 的技能。 */
export function weakSkills(attempts: Attempt[], language: Language, levels: SkillLevels, now: Date = new Date()): Skill[] {
  const since = new Date(now.getTime() - LEVELUP.windowDays * 86_400_000).toISOString();
  return (Object.keys(levels) as Skill[]).filter((skill) => {
    const win = attempts.filter(
      (a) => a.language === language && a.skill === skill && a.at >= since && attemptLevel(a) === levels[skill],
    );
    return win.length >= LEVELUP.weakMinAttempts && win.filter((a) => a.correct).length / win.length < LEVELUP.weakAccuracy;
  });
}
