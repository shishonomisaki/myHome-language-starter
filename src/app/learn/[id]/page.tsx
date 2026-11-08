"use client";

import Link from "next/link";
import { AvatarPicker } from "@/components/AvatarPicker";
import { useEffect, useState } from "react";
import { KANA_ITEMS } from "@/content";
import { useLearner } from "@/components/useLearner";
import { today } from "@/lib/dates";
import { taskKey } from "@/lib/done-tasks";
import { homeworkStatus, recentHomework } from "@/lib/homework";
import { buildDailyPlan, type PlanTask } from "@/lib/plan";
import { loadWeak } from "@/lib/pron-weak-client";
import { prefetchFocus } from "@/lib/focus-prefetch";
import { badgeLabel, currentStreak, goalMetDates, totalHours } from "@/lib/rewards";
import { isDue, isMastered } from "@/lib/srs";
import { allLevelUpStatus, type LevelUpStatus } from "@/lib/levelup";
import { supabaseConfigured } from "@/lib/supabase";
import { countBankChecks } from "@/components/BankReview";
import { LANGUAGE_NAMES, LEVEL_LABELS, SKILLS, SKILL_NAMES, type Language, type LanguageProgress, type RewardState } from "@/lib/types";

const TASK_HREF: Record<PlanTask["kind"], string> = {
  placement: "placement",
  kana: "kana",
  review: "vocab?mode=review",
  vocab: "vocab?mode=new",
  reading: "reading",
  homework: "homework",
  "homework-practice": "homework?mode=practice",
  "homework-extend": "homework?mode=extend",
  "homework-mix": "focus?area=homework",
  focus: "focus",
};

export default function Dashboard() {
  const { learner, repo } = useLearner();
  const [avatar, setAvatar] = useState<string>();
  const [state, setState] = useState<{
    tasks: PlanTask[];
    done: Set<string>;
    progress: LanguageProgress[];
    rewards: RewardState;
    streak: number;
    minutesToday: number;
    hours: number;
    levelUp: Partial<Record<Language, LevelUpStatus[]>>;
    bankChecks: number;
  } | null>(null);

  useEffect(() => {
    if (!learner) return;
    // 背景先把強化單元的題目出好，等一下點進去就不用等。
    void prefetchFocus();
    (async () => {
      const day = today();
      const langs = Object.keys(learner.languages) as Language[];
      const cards = await repo.getCards(learner.id);
      const progress = await Promise.all(langs.map((l) => repo.getProgress(learner.id, l)));
      const kanaMastered = KANA_ITEMS.every((k) => cards.some((c) => c.itemId === k.id && isMastered(c)));
      const perLanguage = Object.fromEntries(
        progress.map((p) => [
          p.language,
          {
            placementDone: p.placementDone,
            levels: p.levels,
            dueReviews: cards.filter((c) => c.itemId.startsWith(`${p.language}-vocab`) && isDue(c, day)).length,
            // 分級測到 N5 以上，代表五十音已經會了。
            kanaMastered: p.language !== "ja" || kanaMastered || p.levels.reading >= 1,
          },
        ]),
      );
      // 學校／安親班作業只給孩子（學習者帳號）用，而且要接上資料庫。
      let homework;
      if (supabaseConfigured && learner.role === "learner" && learner.languages.en) {
        const status = homeworkStatus(await recentHomework(learner.id, 120).catch(() => []), day);
        homework = {
          recordedToday: status.recordedToday,
          practiceReady: Boolean(status.toPractice),
          extendReady: Boolean(status.toExtend),
          mixReady: status.hasPast,
        };
      }
      const pronWeak = [...new Set((await loadWeak(learner.id).catch(() => [])).map((w) => w.language))];
      const logs = await repo.getLogs(learner.id);
      const rewards = await repo.getRewards(learner.id);
      const attempts = await repo.getAttempts(learner.id);
      const levelUp = Object.fromEntries(
        progress.filter((p) => p.placementDone).map((p) => [p.language, allLevelUpStatus(attempts, p.language, p.levels)]),
      );
      const bankChecks = supabaseConfigured && learner.role === "admin" ? await countBankChecks(learner.id).catch(() => 0) : 0;
      setState({
        bankChecks,
        levelUp,
        // 每天輪流挑一個強化項目（以本地日期算第幾天）。
        tasks: buildDailyPlan({ learner, perLanguage, homework, pronWeak, dayIndex: Math.floor(Date.parse(day) / 86_400_000) }),
        done: new Set(await repo.getDoneTasks(learner.id, day).catch(() => [])),
        progress,
        rewards,
        streak: currentStreak(goalMetDates(logs, learner.dailyMinutes), rewards.frozenDates, day),
        minutesToday: logs.filter((l) => l.date === day).reduce((s, l) => s + l.minutes, 0),
        hours: totalHours(logs),
      });
    })();
  }, [learner, repo]);

  if (learner === null) return <p>找不到這位家人。</p>;
  if (!learner || !state) return <p>載入中…</p>;

  const pct = Math.min(100, Math.round((state.minutesToday / learner.dailyMinutes) * 100));

  // 做完的項目打勾變淡、排到後面；全部做完就顯示「今天做完了」。
  const sorted = state.tasks
    .map((t) => {
      const base = `/learn/${learner.id}/${TASK_HREF[t.kind]}${t.area ? `?area=${t.area}` : ""}`;
      const href = `${base}${base.includes("?") ? "&" : "?"}lang=${t.language}&min=${t.minutes}`;
      return { t, href, isDone: state.done.has(taskKey(t.kind, t.language, t.area)) };
    })
    .sort((a, b) => Number(a.isDone) - Number(b.isDone));
  const allDone = sorted.length > 0 && sorted.every((x) => x.isDone);
  // 清單做完但實際練習時間還不到每日目標：接著排加練，直到時間補滿。
  const minutesLeft = Math.max(0, Math.ceil(learner.dailyMinutes - state.minutesToday));
  const needMore = allDone && minutesLeft >= 3;
  const extraLangs = Object.keys(learner.languages) as Language[];
  const extras = extraLangs.flatMap((lang) => {
    const q = `lang=${lang}&min=${minutesLeft}`;
    return [
      { label: "再學一組新單字", href: `/learn/${learner.id}/vocab?${q}`, lang },
      { label: "再讀一篇短文", href: `/learn/${learner.id}/reading?${q}`, lang },
      { label: "讀一篇文化短文", href: `/learn/${learner.id}/reading?topic=culture&${q}`, lang },
      { label: "複習學過的字", href: `/learn/${learner.id}/vocab?mode=review&${q}`, lang },
    ];
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <AvatarPicker
          value={avatar ?? learner.avatar}
          onChange={async (a) => {
            setAvatar(a);
            await repo.saveLearner({ ...learner, avatar: a });
          }}
        />
        <div>
          <h1 className="text-2xl font-semibold">{learner.nickname}</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            🔥 連續 {state.streak} 天 · ⭐ {state.rewards.points} 點 · 🛡️ 保護卡 {state.rewards.freezeCards} 張 · 累計{" "}
            {state.hours.toFixed(1)} 小時
          </p>
        </div>
      </div>

      <section className="card space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">今天的練習</h2>
          <span className="text-sm">
            {Math.round(state.minutesToday)} / {learner.dailyMinutes} 分鐘
          </span>
        </div>
        <div className="h-2 rounded-full bg-black/10 dark:bg-white/10">
          <div className="h-2 rounded-full bg-teal-600" style={{ width: `${pct}%` }} />
        </div>
        {needMore && (
          <div className="space-y-2 rounded-xl bg-amber-50 p-4 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
            <p className="font-semibold">清單做完了，今天還差約 {minutesLeft} 分鐘，再挑幾個加練 💪</p>
            <ul className="space-y-1">
              {extras.map((x) => (
                <li key={x.href} className="flex items-center justify-between gap-3">
                  <span>
                    <span className="mr-2 rounded bg-black/5 px-1.5 py-0.5 text-xs dark:bg-white/10">{LANGUAGE_NAMES[x.lang]}</span>
                    {x.label}
                  </span>
                  <Link className="btn shrink-0 text-sm" href={x.href}>
                    開始
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {allDone && !needMore && (
          <div className="rounded-xl bg-teal-50 p-5 text-center text-teal-900 dark:bg-teal-900/30 dark:text-teal-100">
            <p className="text-4xl">🎉</p>
            <p className="mt-1 text-xl font-bold">今天的練習都做完了！</p>
            <p className="mt-1">可以休息了，明天再來 😊</p>
          </div>
        )}
        {state.bankChecks > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-sky-50 p-3 text-sky-900 dark:bg-sky-900/30 dark:text-sky-100">
            <span>📝 幫忙抽查 {state.bankChecks} 題英文題目</span>
            <Link className="btn shrink-0 text-sm" href={`/learn/${learner.id}/bank-check`}>
              開始
            </Link>
          </div>
        )}
        {learner.languages.en !== undefined && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-violet-50 p-3 text-violet-900 dark:bg-violet-900/30 dark:text-violet-100">
            <span>✍️ 英文作文：{learner.role === "admin" ? "自由選題，AI 老師批改" : "每週寫一段，AI 老師批改"}</span>
            <Link className="btn shrink-0 text-sm" href={`/learn/${learner.id}/essay`}>
              去寫
            </Link>
          </div>
        )}
        <ul className="divide-y divide-black/10 dark:divide-white/10">
          {sorted.map(({ t, href, isDone }, i) => (
            <li key={i} className={`flex items-center justify-between gap-3 py-2 ${isDone ? "opacity-50" : ""}`}>
              <span className={isDone ? "line-through" : ""}>
                <span className="mr-2 inline-block w-6 text-center text-lg">{isDone ? "✅" : "⬜"}</span>
                <span className="mr-2 rounded bg-black/5 px-1.5 py-0.5 text-xs dark:bg-white/10">{LANGUAGE_NAMES[t.language]}</span>
                {t.label}
                {!isDone && <span className="ml-2 text-sm text-black/50 dark:text-white/50">約 {t.minutes} 分鐘</span>}
              </span>
              {isDone ? (
                <span className="flex shrink-0 items-center gap-2 text-sm">
                  <span className="font-semibold text-teal-700 dark:text-teal-300">已完成</span>
                  <Link className="text-xs text-black/50 underline dark:text-white/50" href={href}>
                    再練一次
                  </Link>
                </span>
              ) : (
                <Link className="btn shrink-0 text-sm" href={href}>
                  開始
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {state.progress.map((p) => (
          <div key={p.language} className="card space-y-2">
            <h2 className="font-semibold">{LANGUAGE_NAMES[p.language]}程度</h2>
            {!p.placementDone && <p className="text-sm text-amber-700 dark:text-amber-400">還沒做分級測驗，先用預設級別。</p>}
            <ul className="text-sm">
              {SKILLS.map((s) => (
                <li key={s} className="flex justify-between">
                  <span>{SKILL_NAMES[s]}</span>
                  <span>{LEVEL_LABELS[p.language][p.levels[s]]}</span>
                </li>
              ))}
            </ul>
            {state.levelUp[p.language] && (
              <div className="space-y-1 border-t border-black/10 pt-2 text-sm dark:border-white/10">
                <p className="font-medium">升級進度</p>
                {state.levelUp[p.language]!.map((u) => (
                  <div key={u.skill} className="flex items-center justify-between gap-2">
                    <span>
                      {SKILL_NAMES[u.skill]}：<span className="text-black/60 dark:text-white/60">{u.note}</span>
                    </span>
                    {!u.eligible && (u.skill === "grammar" || u.skill === "listening") && supabaseConfigured && (
                      <Link className="btn-ghost shrink-0 text-sm" href={`/learn/${learner.id}/bank?lang=${p.language}&skill=${u.skill}`}>
                        練習
                      </Link>
                    )}
                    {u.eligible && (
                      <Link className="btn shrink-0 text-sm" href={`/learn/${learner.id}/levelup?lang=${p.language}&skill=${u.skill}`}>
                        挑戰升級
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>

      {state.rewards.badges.length > 0 && (
        <section className="card">
          <h2 className="mb-2 font-semibold">我的徽章</h2>
          <div className="flex flex-wrap gap-2">
            {state.rewards.badges.map((b) => (
              <span key={b} className="rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-900">
                🏅 {badgeLabel(b)}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
