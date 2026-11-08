// 看板統計：每天台灣時間 0 點與 12 點由排程算好存進 board_cache，打開看板時只讀快取。

/** 重算所有家庭的看板快取（排程呼叫）。 */
export async function refreshAllBoards(db: SupabaseClient, now = new Date()): Promise<number> {
  const { data: homes } = await db.from("households").select("id, name, circle, weekly_goal");
  let n = 0;
  for (const h of homes ?? []) {
    const b = await computeBoard(db, h as BoardHome, now);
    if (!b) continue;
    const { error } = await db.from("board_cache").upsert({ household_id: h.id, data: b, computed_at: now.toISOString() });
    if (!error) n++;
  }
  return n;
}
import type { SupabaseClient } from "@supabase/supabase-js";
import { READINGS } from "@/content";
import { addDays } from "@/lib/dates";
import { buildCards, taipeiDate, weekCount, type Board, type BoardInput } from "@/lib/board";

export interface BoardHome { id: string; name: string; circle: string; weekly_goal: number }

/** 完整計算一個家庭的看板（排程與快取失效時用）。 */
export async function computeBoard(db: SupabaseClient, home: BoardHome, now = new Date()): Promise<Board | null> {
  const { data: circleHomes } = await db.from("households").select("id, name, weekly_goal").eq("circle", home.circle).order("created_at");
  const homes = circleHomes?.length ? circleHomes : [{ id: home.id, name: home.name, weekly_goal: home.weekly_goal }];
  // 大家庭模式：同一親族圈所有人一起上看板（欄位還沒建好時當作關閉）。
  const { data: fs } = await db.from("family_settings").select("big_family").eq("id", 1).maybeSingle();
  const big = !!(fs as { big_family?: boolean } | null)?.big_family && homes.length > 1;
  const homeName = new Map(homes.map((h) => [h.id, h.name]));
  const settings = { weekly_goal: home.weekly_goal };

  const today = taipeiDate(now);
  const from21 = addDays(today, -20);
  const from14 = addDays(today, -13);
  const since = new Date(`${from14}T00:00:00+08:00`).toISOString();
  const [profiles, logs, attempts, done, rewards, thoughts, allLogs] = await Promise.all([
    db
      .from("profiles")
      .select("id, nickname, avatar, daily_minutes, household_id")
      .eq("is_learning", true)
      .in("household_id", homes.map((h) => h.id))
      .order("created_at"),
    db.from("daily_logs").select("learner_id, date, minutes").gte("date", from21),
    db.rpc("board_attempt_days", { since }),
    db.from("done_tasks").select("learner_id").eq("date", today),
    db.from("rewards").select("learner_id, frozen_dates"),
    db
      .from("thoughts")
      .select("learner_id, reading_id, idx, answer, featured_at")
      .not("featured_at", "is", null)
      .order("featured_at", { ascending: false })
      .limit(30),
    db.from("daily_logs").select("learner_id, minutes"),
  ]);
  if (profiles.error) return null;

  const all: (BoardInput & { householdId: string })[] = (profiles.data ?? []).map((p) => ({
    householdId: p.household_id,
    id: p.id,
    nickname: p.nickname,
    avatar: p.avatar,
    dailyMinutes: p.daily_minutes,
    frozenDates: (rewards.data ?? []).find((r) => r.learner_id === p.id)?.frozen_dates ?? [],
    logs: (logs.data ?? []).filter((l) => l.learner_id === p.id).map((l) => ({ date: l.date, minutes: Number(l.minutes) })),
    attempts: ((attempts.data ?? []) as { learner_id: string; day: string; total: number; correct: number }[])
      .filter((a) => a.learner_id === p.id)
      .map((a) => ({ date: a.day, total: a.total, correct: a.correct })),
    doneToday: (done.data ?? []).filter((d) => d.learner_id === p.id).length,
  }));
  const people = big ? all : all.filter((p) => p.householdId === home.id);
  const totals = new Map<string, number>();
  for (const l of allLogs.data ?? []) totals.set(l.learner_id, (totals.get(l.learner_id) ?? 0) + Number(l.minutes));
  const cards = buildCards(people, today).map((c) => ({
    ...c,
    totalMinutes: Math.round(totals.get(c.id) ?? 0),
    household: big ? homeName.get(all.find((p) => p.id === c.id)?.householdId ?? "") : undefined,
  }));
  // 親族圈：其他家庭只給概況，不給正確率與思考題。
  const circle = homes
    .filter((h) => !big && h.id !== home.id)
    .map((h) => ({
      household: h.name,
      people: buildCards(
        all.filter((p) => p.householdId === h.id),
        today,
      ).map((c) => ({ nickname: c.nickname, avatar: c.avatar, streak: c.streak, weekMinutes: c.weekMinutes })),
    }))
    .filter((h) => h.people.length > 0);
  const byId = new Map(people.map((p) => [p.id, p]));

  const board: Board = {
    today,
    householdName: big ? "大家庭" : home.name,
    circle,
    cards,
    family: {
      weekCount: people.reduce((s, p) => s + weekCount(p, today), 0),
      weekGoal: big ? homes.reduce((s, h) => s + h.weekly_goal, 0) : settings.weekly_goal,
      todayCount: cards.reduce((s, c) => s + c.todayCount, 0),
      todayMinutes: cards.reduce((s, c) => s + c.todayMinutes, 0),
    },
    highlights: (thoughts.data ?? []).flatMap((t) => {
      const p = byId.get(t.learner_id);
      const r = READINGS.find((x) => x.id === t.reading_id);
      if (!p) return [];
      return [{ nickname: p.nickname, avatar: p.avatar, title: r?.title ?? "", question: r?.think?.[t.idx]?.q ?? "", answer: t.answer, at: t.featured_at }];
    }).slice(0, 5),
  };
  return board;
}

