// 預先出題：
// - POST（登入者）：練完一份後，帶上錯的題目，替下一次先出好；或首頁打開時在背景補齊。
// - GET（Vercel 排程，半夜）：替所有人補齊還沒準備好的項目。
// 每次最多出幾份，避免一次用掉太多 Gemini 額度、也避免超過 60 秒。

import { NextResponse } from "next/server";
import { isFocusArea, missingFor, prepare, prepareHomeworkMix, taipeiDay } from "@/lib/focus-server";
import type { FocusArea, Language } from "@/lib/types";
import { parseLanguage } from "@/lib/types";
import { requireUser, serviceClient } from "@/lib/supabase-server";

export const maxDuration = 60;
const BUDGET_MS = 45_000;

export async function POST(req: Request) {
  const userId = await requireUser(req);
  if (!userId) return NextResponse.json({ error: "請先登入" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const db = serviceClient();
  const day = taipeiDay();
  const start = Date.now();
  let made = 0;

  // 剛練完的那一項：用這次錯的題目出下一份。
  if (isFocusArea(body?.area)) {
    const language: Language = parseLanguage(body?.language);
    const mistakes = (Array.isArray(body?.mistakes) ? body.mistakes : []).map(String).slice(0, 10);
    const r = await prepare(db, userId, language, body.area, { mistakes });
    if (r.ok) made++;
    return NextResponse.json({ made });
  }

  // 首頁背景補齊：一次最多一份，慢慢補。
  const { data: me } = await db.from("profiles").select("focus").eq("id", userId).maybeSingle();
  const todo = await missingFor(db, userId, (me?.focus ?? {}) as Partial<Record<Language, FocusArea[]>>, day);
  if (todo[0] && Date.now() - start < BUDGET_MS) {
    const r = await prepare(db, userId, todo[0].language, todo[0].area);
    if (r.ok) made++;
  } else if (Date.now() - start < BUDGET_MS) {
    // 強化題都準備好了：再替有錄過作業的孩子備好「舊作業變化練習」。
    const r = await prepareHomeworkMix(db, userId, day);
    if (r?.ok) made++;
  }
  return NextResponse.json({ made, left: Math.max(0, todo.length - made) });
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "no" }, { status: 401 });
  const db = serviceClient();
  const day = taipeiDay();
  const start = Date.now();
  const { data: people } = await db.from("profiles").select("id, focus");
  let made = 0;
  for (const p of people ?? []) {
    for (const t of await missingFor(db, p.id, (p.focus ?? {}) as Partial<Record<Language, FocusArea[]>>, day)) {
      if (Date.now() - start > BUDGET_MS) return NextResponse.json({ made, stopped: "time" });
      const r = await prepare(db, p.id, t.language, t.area);
      if (r.ok) made++;
      else return NextResponse.json({ made, stopped: r.reason });
    }
  }
  // 舊作業變化練習：有錄過作業的人，半夜先做好今天那一份。
  const { data: kids } = await db.from("class_homework").select("learner_id").lt("date", day).gte("date", new Date(Date.parse(day) - 120 * 86_400_000).toISOString().slice(0, 10));
  for (const id of new Set((kids ?? []).map((k) => k.learner_id as string))) {
    if (Date.now() - start > BUDGET_MS) return NextResponse.json({ made, stopped: "time" });
    const r = await prepareHomeworkMix(db, id, day);
    if (r?.ok) made++;
    else if (r) return NextResponse.json({ made, stopped: r.reason });
  }
  return NextResponse.json({ made });
}
