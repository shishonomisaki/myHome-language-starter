// 資料存取介面。試用版存在瀏覽器（LocalRepo）；接上 Supabase 後換成同介面的 SupabaseRepo，畫面不用改。

import { emptyRewards } from "./rewards";
import { SupabaseRepo } from "./repo-supabase";
import { getSupabase, supabaseConfigured } from "./supabase";
import type {
  Attempt,
  CardState,
  DailyLog,
  Language,
  LanguageProgress,
  Learner,
  RewardState,
  Thought,
} from "./types";
import { ZERO_LEVELS } from "./types";

export interface Repo {
  listLearners(): Promise<Learner[]>;
  getLearner(id: string): Promise<Learner | undefined>;
  saveLearner(l: Learner): Promise<void>;
  getProgress(learnerId: string, language: Language): Promise<LanguageProgress>;
  saveProgress(learnerId: string, p: LanguageProgress): Promise<void>;
  getCards(learnerId: string): Promise<CardState[]>;
  saveCards(cards: CardState[]): Promise<void>;
  addAttempts(a: Attempt[]): Promise<void>;
  getAttempts(learnerId: string): Promise<Attempt[]>;
  getLogs(learnerId: string): Promise<DailyLog[]>;
  addMinutes(learnerId: string, date: string, minutes: number): Promise<void>;
  getRewards(learnerId: string): Promise<RewardState>;
  saveRewards(r: RewardState): Promise<void>;
  /** 今天做完的練習項目（見 done-tasks.ts 的 taskKey）。 */
  getDoneTasks(learnerId: string, date: string): Promise<string[]>;
  markTaskDone(learnerId: string, date: string, taskKey: string): Promise<void>;
  /** 文化短文思考題：同一篇同一題只留最新的回答。 */
  saveThought(t: Thought): Promise<void>;
  getThoughts(learnerId: string): Promise<Thought[]>;
}

export { ZERO_LEVELS };

interface LocalData {
  learners: Learner[];
  progress: Record<string, LanguageProgress>; // key: learnerId:language
  cards: Record<string, CardState>; // key: learnerId:itemId
  attempts: Attempt[];
  logs: DailyLog[];
  rewards: Record<string, RewardState>;
  done?: Record<string, string[]>; // key: learnerId:date
  thoughts?: Thought[];
}

export const STORAGE_KEY = "myhome-language:v1";

/** 試用版的預設家人（暱稱可在後台改）。 */
export const DEMO_FAMILY: Learner[] = [
  { id: "parent1", nickname: "管理者", role: "admin", isLearning: true, dailyMinutes: 30, languages: { en: 2, ja: 1 }, aiEnabled: true, avatar: "🦁" },
  { id: "parent2", nickname: "家長", role: "admin", isLearning: true, dailyMinutes: 15, languages: { ja: 1 }, aiEnabled: true, avatar: "🦉" },
  { id: "kid-older", nickname: "孩子 A", role: "learner", isLearning: true, dailyMinutes: 30, languages: { en: 2, ja: 1 }, aiEnabled: true, avatar: "🐯" },
  { id: "kid-younger", nickname: "孩子 B", role: "learner", isLearning: true, dailyMinutes: 15, languages: { en: 2, ja: 1 }, aiEnabled: true, avatar: "🐰" },
];

function emptyData(): LocalData {
  return { learners: DEMO_FAMILY, progress: {}, cards: {}, attempts: [], logs: [], rewards: {} };
}

export class LocalRepo implements Repo {
  private data: LocalData;

  constructor(private storage: Pick<Storage, "getItem" | "setItem"> | null) {
    this.data = emptyData();
    try {
      const raw = storage?.getItem(STORAGE_KEY);
      if (raw) this.data = { ...emptyData(), ...JSON.parse(raw) };
    } catch {
      // 讀不到就用預設資料（例如無痕模式）。
    }
  }

  private persist() {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // 存不進去時只留在記憶體。
    }
  }

  async listLearners() {
    return this.data.learners;
  }
  async getLearner(id: string) {
    return this.data.learners.find((l) => l.id === id);
  }
  async saveLearner(l: Learner) {
    const i = this.data.learners.findIndex((x) => x.id === l.id);
    if (i >= 0) this.data.learners[i] = l;
    else this.data.learners.push(l);
    this.persist();
  }
  async getProgress(learnerId: string, language: Language) {
    return (
      this.data.progress[`${learnerId}:${language}`] ?? {
        language,
        levels: { ...ZERO_LEVELS },
        placementDone: false,
      }
    );
  }
  async saveProgress(learnerId: string, p: LanguageProgress) {
    this.data.progress[`${learnerId}:${p.language}`] = p;
    this.persist();
  }
  async getCards(learnerId: string) {
    return Object.values(this.data.cards).filter((c) => c.learnerId === learnerId);
  }
  async saveCards(cards: CardState[]) {
    for (const c of cards) this.data.cards[`${c.learnerId}:${c.itemId}`] = c;
    this.persist();
  }
  async addAttempts(a: Attempt[]) {
    this.data.attempts.push(...a);
    this.persist();
  }
  async getAttempts(learnerId: string) {
    return this.data.attempts.filter((a) => a.learnerId === learnerId);
  }
  async getLogs(learnerId: string) {
    return this.data.logs.filter((l) => l.learnerId === learnerId);
  }
  async addMinutes(learnerId: string, date: string, minutes: number) {
    const log = this.data.logs.find((l) => l.learnerId === learnerId && l.date === date);
    if (log) log.minutes += minutes;
    else this.data.logs.push({ learnerId, date, minutes });
    this.persist();
  }
  async getRewards(learnerId: string) {
    return this.data.rewards[learnerId] ?? emptyRewards(learnerId);
  }
  async saveRewards(r: RewardState) {
    this.data.rewards[r.learnerId] = r;
    this.persist();
  }
  async getDoneTasks(learnerId: string, date: string) {
    return this.data.done?.[`${learnerId}:${date}`] ?? [];
  }
  async markTaskDone(learnerId: string, date: string, taskKey: string) {
    const done = (this.data.done ??= {});
    const k = `${learnerId}:${date}`;
    if (!(done[k] ??= []).includes(taskKey)) done[k].push(taskKey);
    this.persist();
  }
  async saveThought(t: Thought) {
    const list = (this.data.thoughts ??= []).filter((x) => !(x.learnerId === t.learnerId && x.readingId === t.readingId && x.index === t.index));
    this.data.thoughts = [...list, t];
    this.persist();
  }
  async getThoughts(learnerId: string) {
    return (this.data.thoughts ?? []).filter((t) => t.learnerId === learnerId);
  }
}

let repo: Repo | null = null;
export function getRepo(): Repo {
  if (!repo) {
    repo = supabaseConfigured
      ? new SupabaseRepo(getSupabase())
      : new LocalRepo(typeof window === "undefined" ? null : window.localStorage);
  }
  return repo;
}
