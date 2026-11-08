// 伺服器專用：強化單元預先出題。題目平常就先做好放在 focus_ready，打開時直接拿。
import type { SupabaseClient } from "@supabase/supabase-js";
import { withGeminiKey } from "./ai-server";
import { makeFocusDrill, type FocusDrill } from "./gemini";
import { drillFromBank, type BankRow } from "./item-bank";
import { weakForPrompt } from "./pron-weak";
import { weakFor, weakLanguages } from "./pron-weak-server";
import { FOCUS_AREAS, FOCUS_NAMES, FOCUS_SKILL, LEVEL_LABELS, type FocusArea, type Language, type Level } from "./types";

/** 台灣日期 YYYY-MM-DD（伺服器在 UTC）。 */
export function taipeiDay(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(d);
}

export function isFocusArea(a: unknown): a is FocusArea {
  return (FOCUS_AREAS as string[]).includes(String(a));
}

/** 已經準備好、今天可以用的題目：還沒用過，或今天已拿過（同一天重開拿同一份）。 */
export function usable(row: { served_on: string | null } | null, day: string): boolean {
  return !!row && (row.served_on === null || row.served_on === day);
}

type Made = { ok: true; drill: FocusDrill; source: string } | { ok: false; reason: string };

/** 出一份題：先用審過的題庫，不夠才請 Gemini（帶上次錯的題目當複習）。 */
export async function makeDrill(db: SupabaseClient, learnerId: string, language: Language, area: FocusArea, mistakes: string[] = []): Promise<Made> {
  const { data: progress } = await db.from("language_progress").select("levels").eq("learner_id", learnerId).eq("language", language).maybeSingle();
  const levels = (progress?.levels ?? {}) as Record<string, number>;
  const level = Math.min(6, Math.max(0, levels[FOCUS_SKILL[area]] ?? levels.vocab ?? 0)) as Level;
  const { data: bank } = await db
    .from("item_bank")
    .select("id, kind, content")
    .eq("language", language)
    .eq("area", area)
    .eq("status", "approved")
    .gte("level", Math.max(0, level - 1))
    .lte("level", Math.min(6, level + 1))
    .limit(200);
  // 發音：有一再唸不好的字，就不用共用題庫，請 AI 針對這些字出題。
  const weak = area === "pronunciation" ? weakForPrompt(await weakFor(db, learnerId, language)) : [];
  const fromBank = weak.length ? null : drillFromBank((bank ?? []) as BankRow[], `加強${FOCUS_NAMES[area]}`);
  if (fromBank) return { ok: true, drill: fromBank, source: "bank" };
  const r = await withGeminiKey((key) => makeFocusDrill(key, area, language, LEVEL_LABELS[language][level], mistakes, weak));
  return r.ok ? { ok: true, drill: r.value, source: "ai" } : { ok: false, reason: r.reason };
}

/** 若這一項還沒有可用的新題，先做好存起來（servedOn 給值代表馬上要用）。 */
export async function prepare(
  db: SupabaseClient,
  learnerId: string,
  language: Language,
  area: FocusArea,
  opts: { mistakes?: string[]; servedOn?: string | null; force?: boolean } = {},
): Promise<Made> {
  const made = await makeDrill(db, learnerId, language, area, opts.mistakes);
  if (made.ok) {
    await db.from("focus_ready").upsert({
      learner_id: learnerId,
      language,
      area,
      drill: made.drill,
      source: made.source,
      made_at: new Date().toISOString(),
      served_on: opts.servedOn ?? null,
    });
  }
  return made;
}

/** 這個人所有勾選的強化項目裡，還沒準備好下一份的 (語言, 項目)。 */
export async function missingFor(db: SupabaseClient, learnerId: string, focus: Partial<Record<Language, FocusArea[]>>, day: string) {
  const { data: rows } = await db.from("focus_ready").select("language, area, served_on").eq("learner_id", learnerId);
  const ready = new Set((rows ?? []).filter((r) => r.served_on === null || r.served_on === day).map((r) => `${r.language}:${r.area}`));
  // 有一再唸不好的字：就算沒勾「發音」，也自動排加強發音。
  const all: Partial<Record<Language, FocusArea[]>> = { ...focus };
  for (const l of await weakLanguages(db, learnerId)) if (!(all[l] ?? []).includes("pronunciation")) all[l] = [...(all[l] ?? []), "pronunciation"];
  return (Object.entries(all) as [Language, FocusArea[]][]).flatMap(([language, areas]) =>
    (areas ?? []).filter((a) => isFocusArea(a) && !ready.has(`${language}:${a}`)).map((area) => ({ language, area })),
  );
}

// ── 舊作業變化練習：沒有新作業的日子，把以前錄過的作業整理成新的練習 ──

/** focus_ready 裡這份題目的 area 欄位（不是一般強化項目）。 */
export const HOMEWORK_MIX = "homework";
/** 輪流練的項目：單字 → 句型 → 文法。 */
const MIX_AREAS: FocusArea[] = ["vocab", "pattern", "grammar"];
/** 往回找多久以前的作業。 */
const MIX_DAYS = 120;

export function mixArea(day: string): FocusArea {
  const n = Math.floor(Date.parse(day) / 86_400_000);
  return MIX_AREAS[((n % MIX_AREAS.length) + MIX_AREAS.length) % MIX_AREAS.length];
}

type HwRow = { date: string; content: { words?: { word: string; meaning: string }[]; phrases?: { phrase: string }[]; grammar?: { point: string; example: string }[]; sentences?: string[]; issues?: { word: string }[] } };

/** 一份作業壓成一行給 AI 看：只用 AI 當初整理好的文字（錄音、照片沒有存）。 */
export function hwLine(h: HwRow): string {
  const c = h.content ?? {};
  const parts = [
    c.words?.length ? `words: ${c.words.map((w) => w.word).join(", ")}` : "",
    c.phrases?.length ? `phrases: ${c.phrases.map((p) => p.phrase).join(", ")}` : "",
    c.grammar?.length ? `grammar: ${c.grammar.map((g) => `${g.point} (${g.example})`).join("; ")}` : "",
    c.sentences?.length ? `sentences: ${c.sentences.slice(0, 3).join(" / ")}` : "",
    c.issues?.length ? `pronunciation to practise: ${c.issues.map((i) => i.word).join(", ")}` : "",
  ].filter(Boolean);
  return `${h.date}: ${parts.join(" | ")}`;
}

/** 挑三份舊作業：最近一份＋兩份較舊的（每天換），讓舊課也會回來複習。 */
export function pickHomework<T extends { date: string }>(list: T[], day: string): T[] {
  const past = list.filter((h) => h.date < day).sort((a, b) => (a.date < b.date ? 1 : -1));
  if (past.length <= 3) return past.reverse();
  const n = Math.floor(Date.parse(day) / 86_400_000);
  const older = past.slice(1);
  const a = older[n % older.length];
  const b = older[(n + Math.ceil(older.length / 2)) % older.length];
  return [...new Set([past[0], a, b])].sort((x, y) => (x.date < y.date ? -1 : 1));
}

async function pastHomework(db: SupabaseClient, learnerId: string, day: string): Promise<HwRow[]> {
  const since = new Date(Date.parse(day) - MIX_DAYS * 86_400_000).toISOString().slice(0, 10);
  const { data } = await db.from("class_homework").select("date, content").eq("learner_id", learnerId).gte("date", since).lt("date", day);
  return (data ?? []) as HwRow[];
}

/** 有舊作業、而且還沒有今天可用的變化練習，就先做好一份（servedOn 給值代表馬上要用）。 */
export async function prepareHomeworkMix(db: SupabaseClient, learnerId: string, day: string, opts: { servedOn?: string | null; force?: boolean } = {}): Promise<Made | null> {
  if (!opts.force) {
    const { data: row } = await db.from("focus_ready").select("served_on").eq("learner_id", learnerId).eq("language", "en").eq("area", HOMEWORK_MIX).maybeSingle();
    if (usable(row, day)) return null;
  }
  const picked = pickHomework(await pastHomework(db, learnerId, day), day);
  if (!picked.length) return null;
  const area = mixArea(day);
  const { data: progress } = await db.from("language_progress").select("levels").eq("learner_id", learnerId).eq("language", "en").maybeSingle();
  const levels = (progress?.levels ?? {}) as Record<string, number>;
  const level = Math.min(6, Math.max(0, levels[FOCUS_SKILL[area]] ?? levels.vocab ?? 0)) as Level;
  const r = await withGeminiKey((key) => makeFocusDrill(key, area, "en", LEVEL_LABELS.en[level], [], [], picked.map(hwLine)));
  if (!r.ok) return { ok: false, reason: r.reason };
  const drill: FocusDrill = { ...r.value, area };
  await db.from("focus_ready").upsert({
    learner_id: learnerId,
    language: "en",
    area: HOMEWORK_MIX,
    drill,
    source: "homework",
    made_at: new Date().toISOString(),
    served_on: opts.servedOn ?? null,
  });
  return { ok: true, drill, source: "homework" };
}
