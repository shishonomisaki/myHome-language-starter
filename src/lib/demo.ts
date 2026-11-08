// 試用模式（沒接 Supabase）的示範角色與假資料：不用登入就能看各角色畫面、截圖測試。
// 網址加 ?demo=super|family|kid 切換角色；加 &seed=1 灌入示範練習紀錄（只存在這台瀏覽器）。

import { STORAGE_KEY } from "./repo";
import type { Attempt, DailyLog, Language, LanguageProgress, Role, Skill } from "./types";

export type DemoRole = "super" | "family" | "kid";
export const DEMO_ROLES: { id: DemoRole; label: string; role: Role; learnerId: string }[] = [
  { id: "super", label: "👑 超級管理者", role: "admin", learnerId: "parent1" },
  { id: "family", label: "🏠 家庭管理員", role: "family_admin", learnerId: "parent2" },
  { id: "kid", label: "🐯 小孩", role: "learner", learnerId: "kid-older" },
];
const ROLE_KEY = "myhome-language:demo-role";

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** 讀目前的示範角色；網址參數優先，並記住。 */
export function readDemoRole(): DemoRole {
  const s = store();
  let r: string | null = null;
  try {
    r = new URLSearchParams(window.location.search).get("demo");
    if (r && DEMO_ROLES.some((d) => d.id === r)) s?.setItem(ROLE_KEY, r);
    if (new URLSearchParams(window.location.search).get("seed") === "1") seedDemoData();
    r = s?.getItem(ROLE_KEY) ?? null;
  } catch {
    // 無痕模式等讀不到就用預設。
  }
  return DEMO_ROLES.some((d) => d.id === r) ? (r as DemoRole) : "super";
}

export function setDemoRole(r: DemoRole) {
  try {
    store()?.setItem(ROLE_KEY, r);
  } catch {
    // 忽略
  }
}

const SKILLS: Skill[] = ["vocab", "grammar", "reading", "listening", "speaking"];

/** 產生固定的示範資料（同一天跑結果一樣，截圖可比對）。 */
export function demoData(todayIso = new Date().toISOString().slice(0, 10)) {
  const base = new Date(`${todayIso}T12:00:00Z`).getTime();
  const day = (n: number) => new Date(base - n * 86400000).toISOString().slice(0, 10);
  const people: { id: string; langs: Language[]; minutes: number; rate: number; level: number }[] = [
    { id: "parent1", langs: ["en", "ja"], minutes: 30, rate: 0.8, level: 2 },
    { id: "parent2", langs: ["ja"], minutes: 15, rate: 0.9, level: 1 },
    { id: "kid-older", langs: ["en", "ja"], minutes: 30, rate: 0.75, level: 2 },
    { id: "kid-younger", langs: ["en", "ja"], minutes: 15, rate: 0.7, level: 1 },
  ];
  const progress: Record<string, LanguageProgress> = {};
  const logs: DailyLog[] = [];
  const attempts: Attempt[] = [];
  const rewards: Record<string, { learnerId: string; points: number; freezeCards: number; badges: string[]; frozenDates: string[] }> = {};
  people.forEach((p, pi) => {
    for (const lang of p.langs) {
      const lv = lang === "en" ? p.level : 1;
      progress[`${p.id}:${lang}`] = {
        language: lang,
        placementDone: true,
        levels: { vocab: lv as 0, grammar: lv as 0, reading: lv as 0, listening: Math.max(0, lv - 1) as 0, speaking: Math.max(0, lv - 1) as 0 },
      };
    }
    for (let d = 0; d < 14; d++) {
      if ((d + pi) % 5 === 4) continue; // 偶爾沒練，連續天數才有變化
      logs.push({ learnerId: p.id, date: day(d), minutes: p.minutes + ((d * 7 + pi) % 10) });
      SKILLS.forEach((skill, si) => {
        for (let k = 0; k < 3; k++) {
          const n = d * 15 + si * 3 + k + pi;
          attempts.push({
            learnerId: p.id,
            itemId: `demo-${skill}-${n}`,
            language: p.langs[n % p.langs.length],
            skill,
            correct: (n * 37) % 100 < p.rate * 100 - (skill === "speaking" ? 15 : 0),
            at: `${day(d)}T1${si}:0${k}:00.000Z`,
          });
        }
      });
    }
    rewards[p.id] = { learnerId: p.id, points: 300 + pi * 120, freezeCards: 1, badges: ["streak-3"], frozenDates: [] };
  });
  return { progress, logs, attempts, rewards };
}

/** 把示範資料寫進試用版的瀏覽器資料（保留家人名單與其他設定）。 */
export function seedDemoData() {
  const s = store();
  if (!s) return;
  let cur: Record<string, unknown> = {};
  try {
    cur = JSON.parse(s.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    cur = {};
  }
  s.setItem(STORAGE_KEY, JSON.stringify({ ...cur, ...demoData() }));
}
