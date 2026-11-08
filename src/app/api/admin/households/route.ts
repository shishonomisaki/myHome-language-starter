// 超級管理員：家庭清單（含成員與本週練習分鐘）、新增家庭、改名稱/標記/親族圈。

import { NextResponse } from "next/server";
import { addDays } from "@/lib/dates";
import { taipeiDate } from "@/lib/board";
import { requireManager, serviceClient } from "@/lib/supabase-server";

export async function GET(req: Request) {
  const m = await requireManager(req);
  if (!m?.isSuper) return NextResponse.json({ error: "只有超級管理員可以" }, { status: 403 });
  const db = serviceClient();
  const from7 = addDays(taipeiDate(new Date()), -6);
  const [h, p, l] = await Promise.all([
    db.from("households").select("id, name, tag, circle, board_code").order("created_at"),
    db.from("profiles").select("id, nickname, avatar, role, household_id").order("created_at"),
    db.from("daily_logs").select("learner_id, minutes").gte("date", from7),
  ]);
  const fs = await db.from("family_settings").select("big_family").eq("id", 1).maybeSingle();
  if (h.error) return NextResponse.json({ error: "讀取失敗，請確認已執行 SQL 0016–0021" }, { status: 500 });
  const minutes = new Map<string, number>();
  for (const r of l.data ?? []) minutes.set(r.learner_id, (minutes.get(r.learner_id) ?? 0) + Number(r.minutes));
  return NextResponse.json({
    bigFamily: !!(fs.data as { big_family?: boolean } | null)?.big_family,
    bigFamilyReady: !fs.error,
    households: (h.data ?? []).map((x) => {
      const members = (p.data ?? [])
        .filter((y) => y.household_id === x.id)
        .map((y) => ({ id: y.id, nickname: y.nickname, avatar: y.avatar, role: y.role, weekMinutes: Math.round(minutes.get(y.id) ?? 0) }));
      return {
        id: x.id,
        name: x.name,
        tag: x.tag ?? "",
        circle: x.circle,
        hasBoardCode: !!x.board_code,
        members,
        weekMinutes: members.reduce((s, y) => s + y.weekMinutes, 0),
      };
    }),
  });
}

export async function POST(req: Request) {
  const m = await requireManager(req);
  if (!m?.isSuper) return NextResponse.json({ error: "只有超級管理員可以" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (body?.action === "bigFamily") {
    const { error } = await serviceClient().from("family_settings").upsert({ id: 1, big_family: !!body.on });
    if (error) return NextResponse.json({ error: "請先在 SQL Editor 執行 0023_big_family.sql" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  const name = String(body?.name ?? "").trim();
  const tag = String(body?.tag ?? "").trim();
  const circle = String(body?.circle ?? "").trim() || "親族";
  if (!name || name.length > 40) return NextResponse.json({ error: "家庭名稱要 1 到 40 個字" }, { status: 400 });
  if (tag.length > 20) return NextResponse.json({ error: "標記最多 20 個字" }, { status: 400 });
  const db = serviceClient();
  const row = { name, tag: tag || null, circle };
  const { data, error } = body?.id
    ? await db.from("households").update(row).eq("id", String(body.id)).select("id").maybeSingle()
    : await db.from("households").insert(row).select("id").maybeSingle();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "儲存失敗" }, { status: 400 });
  return NextResponse.json({ id: data.id });
}
