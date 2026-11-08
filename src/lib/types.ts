// 全家多語化：核心型別。語言是第一級維度，英、日進度各自獨立。

export type Language = "en" | "ja" | "es";
export const LANGUAGES: Language[] = ["en", "ja", "es"];
export const LANGUAGE_NAMES: Record<Language, string> = { en: "英語", ja: "日語", es: "西語" };

/** 網址 ?lang= 或 API body 的語言代碼；不認得就當英語。 */
export function parseLanguage(v: unknown): Language {
  return v === "ja" || v === "es" ? v : "en";
}

export type Skill = "vocab" | "grammar" | "reading" | "listening" | "speaking";
export const SKILLS: Skill[] = ["vocab", "grammar", "reading", "listening", "speaking"];
export const SKILL_NAMES: Record<Skill, string> = {
  vocab: "字彙",
  grammar: "文法",
  reading: "閱讀",
  listening: "聽力",
  speaking: "口說",
};

/** 內部級別 L0–L6，對應規格書「程度分級路線」。 */
export type Level = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const LEVELS: Level[] = [0, 1, 2, 3, 4, 5, 6];

export const LEVEL_LABELS: Record<Language, Record<Level, string>> = {
  en: {
    0: "L0 入門",
    1: "L1 基礎（初級前）",
    2: "L2 英檢初級",
    3: "L3 英檢中級",
    4: "L4 英檢中高級",
    5: "L5 英檢高級",
    6: "L6 自在交流",
  },
  ja: {
    0: "L0 五十音",
    1: "L1 N5",
    2: "L2 N4",
    3: "L3 N3",
    4: "L4 N2（啃生肉）",
    5: "L5 N1",
    6: "L6 N1 以上",
  },
  es: {
    0: "L0 發音入門",
    1: "L1 DELE A1",
    2: "L2 DELE A2",
    3: "L3 DELE B1",
    4: "L4 DELE B2",
    5: "L5 DELE C1",
    6: "L6 自在交流",
  },
};

/** admin = 超級管理員（看全部）；family_admin = 家庭管理員（只管自己家）。 */
export type Role = "admin" | "family_admin" | "learner";

/** 爸媽帳號：超級管理員或家庭管理員，可以進後台、幫孩子送作業。 */
export function isManager(role: Role | undefined): boolean {
  return role === "admin" || role === "family_admin";
}

export interface Learner {
  id: string;
  /** 暱稱；不放真名，送 AI 時也只用暱稱。 */
  nickname: string;
  role: Role;
  /** 是否也是學習者（管理者可以自選要不要一起練）。 */
  isLearning: boolean;
  /** 每日目標分鐘：15、30、45、60。 */
  dailyMinutes: DailyMinutes;
  /** 英、日要學哪幾種，以及時間分配（0–1，總和 1）。 */
  languages: Partial<Record<Language, number>>;
  /** 後台的 AI 開關，預設開啟。 */
  aiEnabled: boolean;
  /** 管理者指定要加強的項目，每語言可勾多項；每天輪流排一個 10 分鐘強化單元。 */
  focus?: Partial<Record<Language, FocusArea[]>>;
  avatar: string;
  /** 後台替這位家人打開「快速朗讀」：朗讀語速才會多一個 🐇。資料庫還沒有這一欄時是 undefined。 */
  fastSpeech?: boolean;
}

/** 管理者可指定加強的項目。 */
export type FocusArea = "vocab" | "grammar" | "pattern" | "pronunciation" | "listening";
export const FOCUS_AREAS: FocusArea[] = ["vocab", "grammar", "pattern", "pronunciation", "listening"];
export const FOCUS_NAMES: Record<FocusArea, string> = {
  vocab: "字彙",
  grammar: "文法",
  pattern: "句型",
  pronunciation: "發音",
  listening: "聽力",
};
/** 強化單元的作答記到哪個技能。 */
export const FOCUS_SKILL: Record<FocusArea, Skill> = {
  vocab: "vocab",
  grammar: "grammar",
  pattern: "grammar",
  pronunciation: "speaking",
  listening: "listening",
};

export type DailyMinutes = 15 | 30 | 45 | 60;
export const DAILY_MINUTE_OPTIONS: DailyMinutes[] = [15, 30, 45, 60];

/** 每人、每語言、每技能一個級別。 */
export type SkillLevels = Record<Skill, Level>;
export const ZERO_LEVELS: SkillLevels = { vocab: 0, grammar: 0, reading: 0, listening: 0, speaking: 0 };

export interface LanguageProgress {
  language: Language;
  levels: SkillLevels;
  placementDone: boolean;
}

/** 可練習的最小單位：一個單字、一個假名、一題文法。 */
export interface StudyItem {
  id: string;
  language: Language;
  skill: Skill;
  level: Level;
  /** 題面：英文單字、假名、日文單字。 */
  prompt: string;
  /** 正解：中文意思，或假名讀音。 */
  answer: string;
  /** 補充：日文漢字寫法、例句、聯想提示。 */
  extra?: string;
  /** 朗讀用文字（預設等於 prompt）。 */
  speak?: string;
  /** 同組干擾選項分組，例如長得像的假名。 */
  group?: string;
  /** 英文單字的字首、字根、字尾拆解。 */
  parts?: WordPart[];
  /** 片語類別：一般片語、口語、新世代口語。沒有就是單字。 */
  register?: "phrase" | "spoken" | "slang";
  /** 片語的使用場合說明。 */
  usage?: string;
}

export interface WordPart {
  text: string;
  meaning: string;
  kind: "prefix" | "root" | "suffix";
}

/** 間隔重複卡片狀態。 */
export interface CardState {
  itemId: string;
  learnerId: string;
  /** 連續答對次數，決定下次間隔。 */
  streak: number;
  /** 下次到期日（YYYY-MM-DD，本地日期）。 */
  due: string;
  lapses: number;
  lastReviewed?: string;
}

export interface Attempt {
  learnerId: string;
  itemId: string;
  language: Language;
  skill: Skill;
  correct: boolean;
  at: string; // ISO
}

/** 每日練習紀錄，用來算連續天數與累計時數。 */
export interface DailyLog {
  learnerId: string;
  date: string; // YYYY-MM-DD
  minutes: number;
}

export interface RewardState {
  learnerId: string;
  points: number;
  freezeCards: number;
  badges: string[];
  /** 已用掉保護卡的日期，那天算有練。 */
  frozenDates: string[];
}

/** 文化短文的開放式思考題回答（不計分，家長在後台看得到）。 */
export interface Thought {
  learnerId: string;
  readingId: string;
  /** 第幾題思考題。 */
  index: number;
  answer: string;
  at: string;
}
