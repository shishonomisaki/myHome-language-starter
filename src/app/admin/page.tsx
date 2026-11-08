"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { today } from "@/lib/dates";
import { AddMember, resetPassword } from "@/components/AddMember";
import { AiStatus } from "@/components/AiStatus";
import { HouseholdsAdmin, type Household } from "@/components/HouseholdsAdmin";
import { NlmStatus } from "@/components/NlmStatus";
import { useAuth } from "@/components/useAuth";
import { toastError, toastOk } from "@/components/Toast";
import { AvatarPicker } from "@/components/AvatarPicker";
import { BoardAdminProvider, BoardSettings, FeatureButton } from "@/components/BoardAdmin";
import { getRepo, STORAGE_KEY } from "@/lib/repo";
import { READINGS } from "@/content";
import { supabaseConfigured } from "@/lib/supabase";
import { currentStreak, goalMetDates, totalHours } from "@/lib/rewards";
import { weakSkills } from "@/lib/levelup";
import { languageMinutes } from "@/lib/plan";
import {
  DAILY_MINUTE_OPTIONS,
  FOCUS_AREAS,
  FOCUS_NAMES,
  type FocusArea,
  LANGUAGE_NAMES,
  LANGUAGES,
  LEVEL_LABELS,
  type DailyMinutes,
  type Language,
  type LanguageProgress,
  type Learner,
  type Level,
  LEVELS,
  type Skill,
  SKILLS,
  SKILL_NAMES,
  type Thought,
} from "@/lib/types";

type AdminTab = "people" | "home" | "members" | "super";

interface Row {
  learner: Learner;
  minutesToday: number;
  streak: number;
  hours: number;
  points: number;
  progress: LanguageProgress[];
  /** 最近 14 天強化單元小測的答對率（每語言每項）。 */
  focusRates: Record<string, { correct: number; total: number }>;
  /** 降級提醒：最近 14 天本級正確率 < 50% 的技能。 */
  weak: Partial<Record<Language, Skill[]>>;
  /** 文化短文思考題的回答（新到舊）。 */
  thoughts: Thought[];
}

function focusRates(attempts: { itemId: string; language: Language; correct: boolean; at: string }[]) {
  const since = Date.now() - 14 * 86_400_000;
  const out: Record<string, { correct: number; total: number }> = {};
  for (const a of attempts) {
    const m = /^focus-test-(\w+)-/.exec(a.itemId);
    if (!m || Date.parse(a.at) < since) continue;
    const k = `${a.language}:${m[1]}`;
    out[k] ??= { correct: 0, total: 0 };
    out[k].total++;
    if (a.correct) out[k].correct++;
  }
  return out;
}

/** 後台（試用版）：家人設定與總覽。正式版只有 管理者能進來。 */
export default function AdminPage() {
  const repo = getRepo();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [tab, setTab] = useState<AdminTab>("people");
  const auth = useAuth();
  // 試用版沒有登入，當成超級管理員；家庭管理員只看到自己家，看不到家庭、AI、nlm 區塊。
  const isSuper = (auth.status === "demo" && auth.role === "admin") || (auth.status === "signed-in" && auth.me?.role === "admin");
  const [households, setHouseholds] = useState<Household[]>([]);

  async function load() {
    const day = today();
    const learners = await repo.listLearners();
    setRows(
      await Promise.all(
        learners.map(async (learner) => {
          const logs = await repo.getLogs(learner.id);
          const rewards = await repo.getRewards(learner.id);
          const langs = Object.keys(learner.languages) as Language[];
          const progress = await Promise.all(langs.map((l) => repo.getProgress(learner.id, l)));
          const attempts = await repo.getAttempts(learner.id);
          // 資料表還沒建好（0014 沒跑）時不要讓整個後台壞掉。
          const thoughts = await repo.getThoughts(learner.id).catch(() => []);
          return {
            learner,
            minutesToday: logs.filter((l) => l.date === day).reduce((s, l) => s + l.minutes, 0),
            streak: currentStreak(goalMetDates(logs, learner.dailyMinutes), rewards.frozenDates, day),
            hours: totalHours(logs),
            points: rewards.points,
            progress,
            focusRates: focusRates(attempts),
            thoughts: [...thoughts].sort((a, b) => b.at.localeCompare(a.at)),
            weak: Object.fromEntries(
              progress.filter((p) => p.placementDone).map((p) => [p.language, weakSkills(attempts, p.language, p.levels)]),
            ),
          };
        }),
      ),
    );
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(l: Learner) {
    try {
      await repo.saveLearner(l);
      setSavedId(l.id);
      setTimeout(() => setSavedId(null), 1500);
      toastOk(`已儲存：${l.nickname} 的設定`);
      await load();
    } catch (e) {
      toastError(e);
    }
  }

  async function saveLevels(learnerId: string, p: LanguageProgress) {
    try {
      await repo.saveProgress(learnerId, p);
      toastOk("已儲存：等級調整");
      await load();
    } catch (e) {
      toastError(e);
    }
  }

  if (!rows) return <p>載入中…</p>;

  const tabs: { id: AdminTab; label: string }[] = [
    { id: "people", label: "👨‍👩‍👧 家人" },
    ...(supabaseConfigured ? [{ id: "home" as const, label: "🏠 家庭看板" }] : []),
    ...(supabaseConfigured ? [{ id: "members" as const, label: "➕ 成員" }] : [{ id: "members" as const, label: "🧹 試用資料" }]),
    ...(isSuper ? [{ id: "super" as const, label: "👑 超級管理者" }] : []),
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">後台</h1>
      {!supabaseConfigured && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          試用版：資料只存在這台電腦的瀏覽器裡。接上資料庫與登入後，只有管理者看得到這頁，手機 App 與網站會同步。
        </p>
      )}

      <nav className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="後台分頁">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm ${tab === t.id ? "border-teal-600 bg-teal-600 text-white" : "border-black/15 dark:border-white/20"}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "people" && <section className="space-y-3">
        <p className="text-sm text-black/60 dark:text-white/60">按「▼ 展開設定」才會顯示那個人的設定。</p>
        <BoardAdminProvider>
          {rows.map((r) => (
            <LearnerCard key={r.learner.id} row={r} onSave={save} onSaveLevels={saveLevels} saved={savedId === r.learner.id} />
          ))}
        </BoardAdminProvider>
      </section>}

      {supabaseConfigured && isSuper && (
        <section className="card space-y-2" hidden={tab !== "super"}>
          <h2 className="font-semibold">👪 家庭管理</h2>
          <HouseholdsAdmin onChanged={setHouseholds} />
        </section>
      )}

      {tab === "members" && supabaseConfigured && <AddMember onAdded={load} isSuper={isSuper} households={households} />}

      {tab === "home" && supabaseConfigured && (
        <section className="card space-y-2">
          <h2 className="font-semibold">🏠 家庭看板</h2>
          <BoardSettings households={isSuper ? households : []} />
        </section>
      )}

      {tab === "super" && supabaseConfigured && isSuper && (
        <section className="card space-y-2">
          <h2 className="font-semibold">📓 nlm 用量</h2>
          <NlmStatus />
        </section>
      )}

      {tab === "super" && isSuper && <section className="card space-y-2">
        <h2 className="font-semibold">AI 金鑰與模型狀態</h2>
        {supabaseConfigured ? (
          <AiStatus />
        ) : (
          <p className="text-sm text-black/60 dark:text-white/60">接上後端後會顯示每把金鑰的用量、輪換與實際使用的模型。</p>
        )}
        <p className="text-xs text-black/60 dark:text-white/60">
          金鑰只存在伺服器（Supabase Vault），瀏覽器與孩子的帳號都拿不到；送給 AI 的只有暱稱與練習內容。
        </p>
      </section>}

      {tab === "members" && !supabaseConfigured && (
        <section className="card space-y-2">
          <h2 className="font-semibold">試用資料</h2>
          <p className="text-sm text-black/60 dark:text-white/60">清掉這台電腦上的練習紀錄，回到一開始的狀態。</p>
          <button
            type="button"
            className="btn-ghost text-red-700 dark:text-red-400"
            onClick={() => {
              if (!confirm("確定要清掉所有試用紀錄嗎？")) return;
              localStorage.removeItem(STORAGE_KEY);
              location.reload();
            }}
          >
            清除試用紀錄
          </button>
        </section>
      )}
    </div>
  );
}

function LearnerCard({
  row,
  onSave,
  onSaveLevels,
  saved,
}: {
  row: Row;
  onSave: (l: Learner) => void;
  onSaveLevels: (learnerId: string, p: LanguageProgress) => Promise<void>;
  saved: boolean;
}) {
  const [l, setL] = useState(row.learner);
  const dirty = JSON.stringify(l) !== JSON.stringify(row.learner);
  const [open, setOpen] = useState(false);

  function toggleLanguage(lang: Language, on: boolean) {
    const languages = { ...l.languages };
    if (on) languages[lang] = 1;
    else delete languages[lang];
    setL({ ...l, languages });
  }

  function toggleFocus(lang: Language, area: FocusArea, on: boolean) {
    const cur = l.focus?.[lang] ?? [];
    const next = on ? FOCUS_AREAS.filter((a) => a === area || cur.includes(a)) : cur.filter((a) => a !== area);
    setL({ ...l, focus: { ...l.focus, [lang]: next } });
  }

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <AvatarPicker size="text-2xl" value={l.avatar} onChange={(a) => setL({ ...l, avatar: a })} />
          <Link href={`/learn/${l.id}`} className="text-lg font-medium hover:underline">
            {row.learner.nickname}
            {l.role !== "learner" && <span className="ml-2 rounded bg-teal-100 px-1.5 text-xs text-teal-900">{l.role === "admin" ? "超級管理員" : "家庭管理員"}</span>}
          </Link>
        </span>
        <button
          type="button"
          aria-expanded={open}
          className="btn-ghost order-last w-full text-sm sm:order-none sm:w-auto"
          onClick={() => setOpen(!open)}
        >
          {open ? "▲ 收起設定" : "▼ 展開設定"}
        </button>
        <span className="text-sm text-black/60 dark:text-white/60">
          今天 {Math.round(row.minutesToday)} 分 · 連續 {row.streak} 天 · 累計 {row.hours.toFixed(1)} 小時 · {row.points} 點
        </span>
      </div>
      <p className="text-sm">
        {row.progress.map((p) => (
          <span key={p.language} className="mr-4">
            {LANGUAGE_NAMES[p.language]}：{p.placementDone ? LEVEL_LABELS[p.language][p.levels.vocab] : "尚未分級"}
          </span>
        ))}
      </p>
      {row.progress.map(
        (p) =>
          (row.weak[p.language]?.length ?? 0) > 0 && (
            <p
              key={`weak-${p.language}`}
              className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
            >
              ⚠️ {LANGUAGE_NAMES[p.language]}
              {row.weak[p.language]!.map((s) => SKILL_NAMES[s]).join("、")}最近 14 天正確率低於 50%，可考慮手動降一級。
            </p>
          ),
      )}
      {open && <>
      {row.thoughts.length > 0 && (
        <details className="rounded-lg bg-black/5 p-2 text-sm dark:bg-white/5">
          <summary className="cursor-pointer">💭 文化短文的想法（{row.thoughts.length}）：可以當餐桌聊天話題</summary>
          <ul className="mt-2 space-y-2">
            {row.thoughts.slice(0, 20).map((t) => {
              const r = READINGS.find((x) => x.id === t.readingId);
              return (
                <li key={`${t.readingId}-${t.index}`}>
                  <p className="text-xs text-black/60 dark:text-white/60">
                    {t.at.slice(0, 10)}・{r?.title ?? t.readingId}：{r?.think?.[t.index]?.q ?? ""}
                    <FeatureButton learnerId={t.learnerId} readingId={t.readingId} index={t.index} />
                  </p>
                  <p className="whitespace-pre-wrap">{t.answer}</p>
                </li>
              );
            })}
          </ul>
        </details>
      )}
      {row.progress.length > 0 && <details className="rounded-lg border border-black/10 p-2 text-sm dark:border-white/10">
        <summary className="cursor-pointer">⚙️ 進階：手動調整級別</summary>
        <div className="mt-2 space-y-2">
      {row.progress.map((p) => (
        <LevelEditor key={`lv-${p.language}`} progress={p} onSave={(np) => onSaveLevels(row.learner.id, np)} />
      ))}
        </div>
      </details>}
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <label className="flex items-center gap-2">
          暱稱
          <input
            className="flex-1 rounded-lg border border-black/15 bg-transparent px-2 py-1 dark:border-white/20"
            value={l.nickname}
            onChange={(e) => setL({ ...l, nickname: e.target.value })}
          />
        </label>
        <label className="flex items-center gap-2">
          每日目標
          <select
            className="rounded-lg border border-black/15 bg-transparent px-2 py-1 dark:border-white/20"
            value={l.dailyMinutes}
            onChange={(e) => setL({ ...l, dailyMinutes: Number(e.target.value) as DailyMinutes })}
          >
            {DAILY_MINUTE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} 分鐘
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          學習語言
          {LANGUAGES.map((lang) => (
            <span key={lang} className="flex items-center gap-1">
              <input
                type="checkbox"
                id={`${l.id}-${lang}`}
                checked={lang in l.languages}
                onChange={(e) => toggleLanguage(lang, e.target.checked)}
              />
              <label htmlFor={`${l.id}-${lang}`}>{LANGUAGE_NAMES[lang]}</label>
              {lang in l.languages && (
                <select
                  aria-label={`${LANGUAGE_NAMES[lang]}時間比重`}
                  className="rounded border border-black/15 bg-transparent dark:border-white/20"
                  value={l.languages[lang]}
                  onChange={(e) => setL({ ...l, languages: { ...l.languages, [lang]: Number(e.target.value) } })}
                >
                  {[1, 2, 3].map((w) => (
                    <option key={w} value={w}>
                      時間比重 ×{w}
                    </option>
                  ))}
                </select>
              )}
            </span>
          ))}
          {Object.keys(l.languages).length > 1 && (
            <span className="text-xs opacity-70">
              每日{" "}
              {(Object.entries(languageMinutes(l)) as [Language, number][])
                .map(([lang, m]) => `${LANGUAGE_NAMES[lang]} ${m} 分`)
                .join("、")}
            </span>
          )}
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={l.aiEnabled} onChange={(e) => setL({ ...l, aiEnabled: e.target.checked })} />
          使用 AI 口說評分
        </label>
        {l.fastSpeech !== undefined && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={l.fastSpeech} onChange={(e) => setL({ ...l, fastSpeech: e.target.checked })} />
            開放快速朗讀 🐇（母語人士聊天的速度，需要時才切）
          </label>
        )}
      </div>
      {(Object.keys(l.languages) as Language[]).map((lang) => (
        <div key={lang} className="flex flex-wrap items-center gap-3 text-sm">
          <span>💪 加強{LANGUAGE_NAMES[lang]}</span>
          {FOCUS_AREAS.map((area) => {
            const rate = row.focusRates[`${lang}:${area}`];
            return (
              <span key={area} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  id={`${l.id}-${lang}-${area}`}
                  checked={l.focus?.[lang]?.includes(area) ?? false}
                  onChange={(e) => toggleFocus(lang, area, e.target.checked)}
                />
                <label htmlFor={`${l.id}-${lang}-${area}`}>
                  {FOCUS_NAMES[area]}
                  {rate && (
                    <span className="ml-1 text-black/50 dark:text-white/50">（小測 {Math.round((rate.correct / rate.total) * 100)}%）</span>
                  )}
                </label>
              </span>
            );
          })}
        </div>
      ))}
      {Object.values(l.focus ?? {}).some((a) => a?.length) && (
        <p className="text-xs text-black/50 dark:text-white/50">
          勾選的項目每天輪流排一個 10 分鐘單元（練習＋複習＋小測），算在每日時間內，不另外加量。
        </p>
      )}
      <div className="flex items-center gap-3">
        <button type="button" className="btn" disabled={!dirty || !Object.keys(l.languages).length} onClick={() => onSave(l)}>
          儲存
        </button>
        {saved && <span className="text-sm text-green-700 dark:text-green-400">已儲存</span>}
        {supabaseConfigured && (
          <button
            type="button"
            className="btn-ghost ml-auto text-sm"
            onClick={async () => {
              const pw = prompt(`幫 ${row.learner.nickname} 設定新密碼（至少 8 個字）`);
              if (!pw) return;
              try {
                await resetPassword(l.id, pw);
                toastOk(`已儲存：${row.learner.nickname} 的新密碼`);
              } catch (e) {
                toastError(e);
              }
            }}
          >
            重設密碼
          </button>
        )}
      </div>
      </>}
    </div>
  );
}

/** 管理者手動調整每項技能的級別。 */
function LevelEditor({ progress, onSave }: { progress: LanguageProgress; onSave: (p: LanguageProgress) => Promise<void> }) {
  const [levels, setLevels] = useState(progress.levels);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(levels) !== JSON.stringify(progress.levels);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer">手動調整{LANGUAGE_NAMES[progress.language]}級別</summary>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {SKILLS.map((s) => (
          <label key={s} className="flex items-center justify-between gap-2">
            {SKILL_NAMES[s]}
            <select
              className="rounded-lg border border-black/15 bg-transparent px-2 py-1 dark:border-white/20"
              value={levels[s]}
              onChange={(e) => setLevels({ ...levels, [s]: Number(e.target.value) as Level })}
            >
              {LEVELS.map((lv) => (
                <option key={lv} value={lv}>
                  {LEVEL_LABELS[progress.language][lv]}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <button
        type="button"
        className="btn mt-2 text-sm"
        disabled={!dirty || busy}
        onClick={async () => {
          setBusy(true);
          await onSave({ ...progress, levels, placementDone: true });
          setBusy(false);
        }}
      >
        儲存級別
      </button>
    </details>
  );
}
