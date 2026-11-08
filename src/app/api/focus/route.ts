// 強化單元：直接拿事先做好的題目（focus_ready）。沒有準備好才現場出題（題庫優先、再請 Gemini）。

import { NextResponse } from "next/server";
import { HOMEWORK_MIX, isFocusArea, prepare, prepareHomeworkMix, taipeiDay, usable } from "@/lib/focus-server";
import { silentListening } from "@/lib/item-bank";
import type { FocusDrill } from "@/lib/gemini";
import type { Language } from "@/lib/types";
import { parseLanguage } from "@/lib/types";
import { requireUser, serviceClient } from "@/lib/supabase-server";

export const maxDuration = 60;

export async function POST(req: Request) {
  const userId = await requireUser(req);
  if (!userId) return NextResponse.json({ error: "請先登入" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const language: Language = parseLanguage(body?.language);
  const area = body?.area;
  if (area === HOMEWORK_MIX) return homeworkMix(userId);
  if (!isFocusArea(area)) return NextResponse.json({ error: "沒有這個項目" }, { status: 400 });

  const db = serviceClient();
  const day = taipeiDay();
  const { data: row } = await db
    .from("focus_ready")
    .select("drill, served_on")
    .eq("learner_id", userId)
    .eq("language", language)
    .eq("area", area)
    .maybeSingle();
  if (row && usable(row, day) && !(area === "listening" && silentListening(row.drill as FocusDrill))) {
    if (row.served_on === null) await db.from("focus_ready").update({ served_on: day }).eq("learner_id", userId).eq("language", language).eq("area", area);
    return NextResponse.json(row.drill);
  }

  // 備案：沒有預先做好的題目，才現場出。
  const made = await prepare(db, userId, language, area, { servedOn: day });
  if (!made.ok) return NextResponse.json({ error: `${made.reason}，今天先做其他練習` }, { status: 503 });
  return NextResponse.json(made.drill);
}

/** 舊作業變化練習：拿預先做好的；沒有才現場做。 */
async function homeworkMix(userId: string) {
  const db = serviceClient();
  const day = taipeiDay();
  const { data: row } = await db.from("focus_ready").select("drill, served_on").eq("learner_id", userId).eq("language", "en").eq("area", HOMEWORK_MIX).maybeSingle();
  if (row && usable(row, day)) {
    if (row.served_on === null) await db.from("focus_ready").update({ served_on: day }).eq("learner_id", userId).eq("language", "en").eq("area", HOMEWORK_MIX);
    return NextResponse.json(row.drill);
  }
  const made = await prepareHomeworkMix(db, userId, day, { servedOn: day, force: true });
  if (!made) return NextResponse.json({ error: "還沒有錄過的作業，今天先做其他練習" }, { status: 404 });
  if (!made.ok) return NextResponse.json({ error: `${made.reason}，今天先做其他練習` }, { status: 503 });
  return NextResponse.json(made.drill);
}
