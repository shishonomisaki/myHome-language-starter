// 排程：每天台灣時間 0 點與 12 點重算所有家庭的看板快取。
import { NextResponse } from "next/server";
import { refreshAllBoards } from "@/lib/board-server";
import { serviceClient } from "@/lib/supabase-server";

export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "no" }, { status: 401 });
  const n = await refreshAllBoards(serviceClient());
  return NextResponse.json({ refreshed: n });
}
