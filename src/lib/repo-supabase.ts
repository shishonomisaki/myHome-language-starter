// 正式版資料存取：Supabase。權限由資料庫的 RLS 把關（自己的資料或管理者）。

import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyRewards } from "./rewards";
import type { Repo } from "./repo";
import { ZERO_LEVELS, type Attempt, type CardState, type DailyLog, type Language, type LanguageProgress, type Learner, type RewardState, type Thought } from "./types";

interface ProfileRow {
  id: string;
  nickname: string;
  avatar: string;
  role: Learner["role"];
  is_learning: boolean;
  daily_minutes: Learner["dailyMinutes"];
  languages: Learner["languages"];
  ai_enabled: boolean;
  focus: Learner["focus"] | null;
  /** 0023 才有這一欄，還沒執行時 select * 不會帶回來。 */
  fast_speech?: boolean;
}

function toLearner(r: ProfileRow): Learner {
  return {
    id: r.id,
    nickname: r.nickname,
    avatar: r.avatar,
    role: r.role,
    isLearning: r.is_learning,
    dailyMinutes: r.daily_minutes,
    languages: r.languages,
    aiEnabled: r.ai_enabled,
    focus: r.focus ?? {},
    ...("fast_speech" in r ? { fastSpeech: r.fast_speech === true } : {}),
  };
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export class SupabaseRepo implements Repo {
  constructor(private db: SupabaseClient) {}

  async listLearners() {
    const rows = check(await this.db.from("profiles").select("*").order("created_at"));
    return (rows as ProfileRow[]).map(toLearner);
  }
  async getLearner(id: string) {
    const row = check(await this.db.from("profiles").select("*").eq("id", id).maybeSingle());
    return row ? toLearner(row as ProfileRow) : undefined;
  }
  async saveLearner(l: Learner) {
    // 角色只能由管理者改（資料庫有 trigger 擋），這裡照樣送出。
    check(
      await this.db
        .from("profiles")
        .update({
          nickname: l.nickname,
          avatar: l.avatar,
          role: l.role,
          is_learning: l.isLearning,
          daily_minutes: l.dailyMinutes,
          languages: l.languages,
          ai_enabled: l.aiEnabled,
          focus: l.focus ?? {},
          // 資料庫有這一欄（讀到過）才送，沒執行 SQL 之前不會讓存檔失敗。
          ...(l.fastSpeech === undefined ? {} : { fast_speech: l.fastSpeech }),
        })
        .eq("id", l.id),
    );
  }
  async getProgress(learnerId: string, language: Language): Promise<LanguageProgress> {
    const row = check(
      await this.db
        .from("language_progress")
        .select("levels, placement_done")
        .eq("learner_id", learnerId)
        .eq("language", language)
        .maybeSingle(),
    );
    return row
      ? { language, levels: { ...ZERO_LEVELS, ...row.levels }, placementDone: row.placement_done }
      : { language, levels: { ...ZERO_LEVELS }, placementDone: false };
  }
  async saveProgress(learnerId: string, p: LanguageProgress) {
    check(
      await this.db.from("language_progress").upsert({
        learner_id: learnerId,
        language: p.language,
        levels: p.levels,
        placement_done: p.placementDone,
        updated_at: new Date().toISOString(),
      }),
    );
  }
  async getCards(learnerId: string): Promise<CardState[]> {
    const rows = check(await this.db.from("cards").select("*").eq("learner_id", learnerId));
    return (rows ?? []).map((r) => ({
      learnerId: r.learner_id,
      itemId: r.item_id,
      streak: r.streak,
      due: r.due,
      lapses: r.lapses,
      lastReviewed: r.last_reviewed ?? undefined,
    }));
  }
  async saveCards(cards: CardState[]) {
    if (!cards.length) return;
    check(
      await this.db.from("cards").upsert(
        cards.map((c) => ({
          learner_id: c.learnerId,
          item_id: c.itemId,
          streak: c.streak,
          due: c.due,
          lapses: c.lapses,
          last_reviewed: c.lastReviewed ?? null,
        })),
      ),
    );
  }
  async addAttempts(a: Attempt[]) {
    if (!a.length) return;
    check(
      await this.db.from("attempts").insert(
        a.map((x) => ({
          learner_id: x.learnerId,
          item_id: x.itemId,
          language: x.language,
          skill: x.skill,
          correct: x.correct,
          at: x.at,
        })),
      ),
    );
  }
  async getAttempts(learnerId: string): Promise<Attempt[]> {
    const rows = check(
      await this.db.from("attempts").select("*").eq("learner_id", learnerId).order("at", { ascending: false }).limit(2000),
    );
    return (rows ?? []).map((r) => ({
      learnerId: r.learner_id,
      itemId: r.item_id,
      language: r.language,
      skill: r.skill,
      correct: r.correct,
      at: r.at,
    }));
  }
  async getLogs(learnerId: string): Promise<DailyLog[]> {
    const rows = check(await this.db.from("daily_logs").select("*").eq("learner_id", learnerId));
    return (rows ?? []).map((r) => ({ learnerId: r.learner_id, date: r.date, minutes: Number(r.minutes) }));
  }
  async addMinutes(learnerId: string, date: string, minutes: number) {
    check(await this.db.rpc("add_minutes", { p_learner: learnerId, p_date: date, p_minutes: minutes }));
  }
  async getRewards(learnerId: string): Promise<RewardState> {
    const row = check(await this.db.from("rewards").select("*").eq("learner_id", learnerId).maybeSingle());
    if (!row) return emptyRewards(learnerId);
    return {
      learnerId,
      points: row.points,
      freezeCards: row.freeze_cards,
      badges: row.badges,
      frozenDates: row.frozen_dates,
    };
  }
  async saveRewards(r: RewardState) {
    check(
      await this.db.from("rewards").upsert({
        learner_id: r.learnerId,
        points: r.points,
        freeze_cards: r.freezeCards,
        badges: r.badges,
        frozen_dates: r.frozenDates,
      }),
    );
  }
  async getDoneTasks(learnerId: string, date: string) {
    const rows = check(await this.db.from("done_tasks").select("task_key").eq("learner_id", learnerId).eq("date", date));
    return (rows ?? []).map((r) => r.task_key as string);
  }
  async markTaskDone(learnerId: string, date: string, taskKey: string) {
    check(
      await this.db
        .from("done_tasks")
        .upsert({ learner_id: learnerId, date, task_key: taskKey }, { onConflict: "learner_id,date,task_key", ignoreDuplicates: true }),
    );
  }
  async saveThought(t: Thought) {
    check(
      await this.db
        .from("thoughts")
        .upsert(
          { learner_id: t.learnerId, reading_id: t.readingId, idx: t.index, answer: t.answer, at: t.at },
          { onConflict: "learner_id,reading_id,idx" },
        ),
    );
  }
  async getThoughts(learnerId: string) {
    const rows = check(await this.db.from("thoughts").select("reading_id, idx, answer, at").eq("learner_id", learnerId).order("at", { ascending: false }));
    return (rows ?? []).map((r) => ({ learnerId, readingId: r.reading_id as string, index: r.idx as number, answer: r.answer as string, at: r.at as string }));
  }
}
