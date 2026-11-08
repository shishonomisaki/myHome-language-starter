// 後台：設定自己家庭的看板通關碼、每週目標，以及把思考題設為亮點。
// 家庭管理員只能設自己家；超級管理員可以用 householdId 指定家庭。

import { NextResponse } from "next/server";
import { canManage, requireManager, serviceClient, type Manager } from "@/lib/supabase-server";

function pickHousehold(m: Manager, asked: unknown): string {
  return m.isSuper && typeof asked === "string" && asked ? asked : m.householdId;
}

export async function GET(req: Request) {
  const m = await requireManager(req);
  if (!m) return NextResponse.json({ error: "只有管理者可以" }, { status: 403 });
  const db = serviceClient();
  const hh = pickHousehold(m, new URL(req.url).searchParams.get("householdId"));
  const [s, t] = await Promise.all([
    db.from("households").select("board_code, weekly_goal").eq("id", hh).maybeSingle(),
    db.from("thoughts").select("learner_id, reading_id, idx").not("featured_at", "is", null),
  ]);
  return NextResponse.json({
    code: s.data?.board_code ?? "",
    weeklyGoal: s.data?.weekly_goal ?? 300,
    featured: (t.data ?? []).map((r) => `${r.learner_id}:${r.reading_id}:${r.idx}`),
  });
}

export async function POST(req: Request) {
  const m = await requireManager(req);
  if (!m) return NextResponse.json({ error: "只有管理者可以" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const db = serviceClient();
  if (body?.action === "settings") {
    const code = String(body.code ?? "").trim();
    const weeklyGoal = Math.round(Number(body.weeklyGoal));
    if (code.length < 4 || code.length > 32) return NextResponse.json({ error: "通關碼要 4 到 32 個字" }, { status: 400 });
    if (!(weeklyGoal >= 10 && weeklyGoal <= 5000)) return NextResponse.json({ error: "每週目標要在 10 到 5000 題之間" }, { status: 400 });
    const { error } = await db
      .from("households")
      .update({ board_code: code, weekly_goal: weeklyGoal })
      .eq("id", pickHousehold(m, body.householdId));
    if (error?.code === "23505") return NextResponse.json({ error: "這個通關碼別的家庭用過了，請換一個" }, { status: 400 });
    if (error) return NextResponse.json({ error: "儲存失敗，請確認已執行 SQL 0016–0021" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (body?.action === "feature") {
    if (!(await canManage(m, String(body.learnerId)))) return NextResponse.json({ error: "找不到這位家人" }, { status: 404 });
    const { error } = await db
      .from("thoughts")
      .update({ featured_at: body.on ? new Date().toISOString() : null })
      .eq("learner_id", String(body.learnerId))
      .eq("reading_id", String(body.readingId))
      .eq("idx", Number(body.index));
    if (error) return NextResponse.json({ error: "儲存失敗，請確認已執行 SQL 0015" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "不認得的動作" }, { status: 400 });
}
