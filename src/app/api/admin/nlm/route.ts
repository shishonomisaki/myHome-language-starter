// 超級管理員：nlm（NotebookLM）用量概況。Google 不提供剩餘額度，這裡是 Claude 每次批次自己記的帳。

import { NextResponse } from "next/server";
import { NLM_LIMITS, summarizeNlm } from "@/lib/nlm-usage";
import { requireManager, serviceClient } from "@/lib/supabase-server";

export async function GET(req: Request) {
  const m = await requireManager(req);
  if (!m?.isSuper) return NextResponse.json({ error: "只有超級管理員可以" }, { status: 403 });
  const db = serviceClient();
  const since = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
  const [u, n] = await Promise.all([
    db.from("nlm_usage").select("at, kind, count, blocked").gte("at", since),
    db.from("nlm_notebooks").select("id, title, sources, checked_at").order("sources", { ascending: false }),
  ]);
  if (u.error) return NextResponse.json({ error: "讀取失敗，請確認已執行 SQL 0021" }, { status: 500 });
  return NextResponse.json({ limits: NLM_LIMITS, ...summarizeNlm(u.data ?? [], n.data ?? [], new Date()) });
}
