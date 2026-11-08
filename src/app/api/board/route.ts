// 家庭看板資料：用家庭通關碼取得，不用登入。只回傳暱稱與統計，以及家長核准的思考題亮點。

import { NextResponse } from "next/server";
import type { Board } from "@/lib/board";
import { computeBoard } from "@/lib/board-server";
import { serviceClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "").trim();
  const db = serviceClient();
  // 每個家庭有自己的通關碼，通關碼決定看哪一家。
  const { data: home } = code
    ? await db.from("households").select("id, name, circle, weekly_goal").eq("board_code", code).maybeSingle()
    : { data: null };
  if (!home) {
    await new Promise((r) => setTimeout(r, 800)); // 放慢亂猜
    return NextResponse.json({ error: "通關碼不對" }, { status: 401 });
  }
  // 看板一律讀快取（每天 0 點與 12 點由排程算好）；只有第一次還沒有快取時才現場算一次。
  const { data: cache } = await db.from("board_cache").select("data, computed_at").eq("household_id", home.id).maybeSingle();
  let board = cache ? ({ ...(cache.data as Board), computedAt: cache.computed_at as string }) : null;
  if (!board) {
    const fresh = await computeBoard(db, home);
    if (!fresh) return NextResponse.json({ error: "讀取失敗，稍後再試" }, { status: 500 });
    const computedAt = new Date().toISOString();
    await db.from("board_cache").upsert({ household_id: home.id, data: fresh, computed_at: computedAt });
    board = { ...fresh, computedAt };
  }
  return NextResponse.json(board, { headers: { "cache-control": "no-store" } });
}
