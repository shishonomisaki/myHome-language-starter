// 每日練習清單：依每日分鐘數、英日時間分配、到期複習與弱點排出今天要做的事。

import { FOCUS_NAMES, FOCUS_SKILL, type FocusArea, type Language, type Learner, type Skill, type SkillLevels } from "./types";

export interface PlanTask {
  language: Language;
  kind: "kana" | "review" | "vocab" | "reading" | "placement" | "homework" | "homework-practice" | "homework-extend" | "homework-mix" | "focus";
  skill: Skill;
  minutes: number;
  label: string;
  /** 強化單元的項目。 */
  area?: FocusArea;
}

export interface PlanInput {
  learner: Learner;
  /** 每語言：是否做過分級測驗、各技能級別、到期複習張數。 */
  perLanguage: Partial<
    Record<Language, { placementDone: boolean; levels: SkillLevels; dueReviews: number; kanaMastered: boolean }>
  >;
  /** 孩子的學校／安親班英文作業：今天錄了沒、有沒有之前錄的還沒練。只有英語用。 */
  homework?: { recordedToday: boolean; practiceReady: boolean; extendReady: boolean; mixReady?: boolean };
  /** 有一再唸不好的字的語言：沒勾「發音」也自動排加強發音。 */
  pronWeak?: Language[];
  /** 第幾天（任意遞增的整數），用來輪流挑今天的強化項目。 */
  dayIndex?: number;
}

/** 強化＋複習＋測試合起來一個單元約 10 分鐘。 */
export const FOCUS_UNIT_MINUTES = 10;


/** 每張複習卡大約 0.25 分鐘。 */
const MIN_PER_REVIEW = 0.25;

export function languageMinutes(learner: Learner): Partial<Record<Language, number>> {
  const entries = Object.entries(learner.languages) as [Language, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0) || 1;
  const out: Partial<Record<Language, number>> = {};
  for (const [lang, w] of entries) out[lang] = Math.round((learner.dailyMinutes * w) / total);
  return out;
}

export function buildDailyPlan({ learner, perLanguage, homework, pronWeak = [], dayIndex = 0 }: PlanInput): PlanTask[] {
  const tasks: PlanTask[] = [];
  const minutes = languageMinutes(learner);
  // 每天整個強化區塊只有一個 10 分鐘單元：所有語言勾選的項目排成一列，每天輪到一個。
  const focusPool = (Object.keys(minutes) as Language[]).flatMap((lang) =>
    perLanguage[lang]?.placementDone
      ? [...(learner.focus?.[lang] ?? []), ...(pronWeak.includes(lang) && !(learner.focus?.[lang] ?? []).includes("pronunciation") ? ["pronunciation" as const] : [])].map((area) => ({ lang, area }))
      : [],
  );
  const todayFocus = focusPool.length ? focusPool[((dayIndex % focusPool.length) + focusPool.length) % focusPool.length] : undefined;

  for (const [language, budget] of Object.entries(minutes) as [Language, number][]) {
    const p = perLanguage[language];
    if (!p || budget <= 0) continue;
    let left = budget;
    // 管理者指定的強化單元：算在每日時間裡，不另外加量；分級測驗做完才排。
    const area = todayFocus?.lang === language ? todayFocus.area : undefined;
    let focusDone = false;
    const pushFocus = () => {
      if (!area || focusDone || left <= 0) return;
      const m = Math.min(FOCUS_UNIT_MINUTES, left);
      tasks.push({ language, kind: "focus", skill: FOCUS_SKILL[area], minutes: m, area, label: `💪 加強${FOCUS_NAMES[area]}（練習＋複習＋小測）` });
      left -= m;
      focusDone = true;
    };

    // 班上作業算在每日時間裡、取代網站自己排的練習，不另外加量。
    // 錄音放第一項，上網時段到了也已經送出。
    const hw = language === "en" ? homework : undefined;
    if (hw) {
      const half = Math.min(15, Math.ceil(budget / 2));
      let review = half;
      if (!hw.recordedToday && left > 0) {
        const m = Math.min(3, left);
        tasks.push({ language, kind: "homework", skill: "speaking", minutes: m, label: "🎤 錄今天的英文作業" });
        left -= m;
        review -= m;
      }
      if (hw.practiceReady && review > 0 && left > 0) {
        const m = Math.min(review, left);
        tasks.push({ language, kind: "homework-practice", skill: "vocab", minutes: m, label: "作業複習（單字、文法、跟讀）" });
        left -= m;
      }
      // 強化單元從延伸那一半撥時間，孩子仍在 30 分鐘內做完。
      pushFocus();
      if (hw.extendReady && left > 0) {
        const m = Math.min(half, left);
        tasks.push({ language, kind: "homework-extend", skill: "reading", minutes: m, label: "從課程延伸（新單字、短文）" });
        left -= m;
      }
      // 沒有新作業要複習、延伸時：把以前錄過的作業混在一起、換情境出新題（題目半夜先做好）。
      if (hw.mixReady && !hw.practiceReady && !hw.extendReady && left > 0) {
        const m = Math.min(FOCUS_UNIT_MINUTES, left);
        tasks.push({ language, kind: "homework-mix", skill: "vocab", minutes: m, label: "🔁 舊作業變化練習（以前的課換個情境再玩）" });
        left -= m;
      }
    }

    // 分級測驗先做；日語的分級從五十音開始測，會的人就不用再練五十音。
    if (!p.placementDone && left > 0) {
      tasks.push({ language, kind: "placement", skill: "vocab", minutes: Math.min(20, left), label: "分級測驗" });
      left -= Math.min(20, left);
    }

    // 日語先過五十音：每天 5 分鐘短練。
    if (language === "ja" && p.placementDone && !p.kanaMastered && left > 0) {
      const m = Math.min(5, left);
      tasks.push({ language, kind: "kana", skill: "reading", minutes: m, label: "五十音（今天 5 個新字＋複習）" });
      left -= m;
    }

    pushFocus();

    if (p.dueReviews > 0 && left > 0) {
      const m = Math.min(left, Math.max(2, Math.ceil(p.dueReviews * MIN_PER_REVIEW)));
      tasks.push({ language, kind: "review", skill: "vocab", minutes: m, label: `複習 ${p.dueReviews} 張到期字卡` });
      left -= m;
    }

    if (left > 0) {
      // 字彙與閱讀對半，級別較低的那項多分一點。
      const vocabFirst = p.levels.vocab <= p.levels.reading;
      const a = Math.ceil(left / 2);
      const b = left - a;
      const vocabMin = vocabFirst ? a : b;
      const readingMin = vocabFirst ? b : a;
      if (vocabMin > 0) tasks.push({ language, kind: "vocab", skill: "vocab", minutes: vocabMin, label: "學新單字" });
      if (readingMin > 0) tasks.push({ language, kind: "reading", skill: "reading", minutes: readingMin, label: "分級短文閱讀" });
    }
  }
  return tasks;
}
