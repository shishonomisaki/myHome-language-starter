// 孩子錄的學校／安親班英文作業：交給 Gemini 整理成隔天的練習，存進 class_homework（一人一天一筆，重錄覆蓋）。

import { NextResponse } from "next/server";
import { audioError, withGeminiKey } from "@/lib/ai-server";
import { today } from "@/lib/dates";
import { LEVEL_LABELS, type Level } from "@/lib/types";
import { analyzeHomework, type Image } from "@/lib/gemini";
import { requireUser, serviceClient } from "@/lib/supabase-server";

/** 3 分鐘錄音約 1–2 MB，base64 再多三分之一；Vercel 請求上限 4.5 MB。 */
const MAX_AUDIO_BASE64 = 3_000_000;
/** 照片在瀏覽器先縮小，通常 200–400 KB。 */
const MAX_IMAGE_BASE64 = 1_200_000;

/** Gemini 聽錄音要幾秒到幾十秒。 */
export const maxDuration = 60;

export async function POST(req: Request) {
  const userId = await requireUser(req);
  if (!userId) return NextResponse.json({ error: "請先登入" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const audio = String(body?.audio ?? "");
  const mimeType = String(body?.mimeType ?? "").split(";")[0];
  // 日期用孩子電腦上的日期（跟每日計畫一致），只接受 YYYY-MM-DD。
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.date))
    ? String(body.date)
    : today();
  const bad = audioError(audio, mimeType, MAX_AUDIO_BASE64);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  // 課本照片可有可無。
  const imageData = String(body?.image ?? "");
  const imageType = String(body?.imageType ?? "");
  let image: Image | undefined;
  if (imageData) {
    if (!/^image\/(jpeg|png|webp)$/.test(imageType))
      return NextResponse.json({ error: "照片格式不對" }, { status: 400 });
    if (imageData.length > MAX_IMAGE_BASE64)
      return NextResponse.json({ error: "照片太大" }, { status: 413 });
    image = { base64: imageData, mimeType: imageType };
  }

  // 家長代傳：管理者可以指定孩子帳號，錄音和照片算在孩子名下。
  const db = serviceClient();
  const asked = String(body?.learnerId ?? "");
  let learnerId = userId;
  if (asked && asked !== userId) {
    const { data: me } = await db
      .from("profiles")
      .select("role, household_id")
      .eq("id", userId)
      .maybeSingle();
    if (me?.role !== "admin" && me?.role !== "family_admin")
      return NextResponse.json(
        { error: "只有爸媽的帳號可以幫孩子送作業" },
        { status: 403 },
      );
    const { data: kid } = await db
      .from("profiles")
      .select("id, household_id")
      .eq("id", asked)
      .maybeSingle();
    // 家庭管理員只能幫自己家的孩子送。
    if (!kid || (me.role === "family_admin" && kid.household_id !== me.household_id))
      return NextResponse.json({ error: "找不到這位家人" }, { status: 404 });
    learnerId = asked;
  }

  // 延伸教材對準孩子原本規劃的程度：取字彙、閱讀較高的那項再往上一級。
  const { data: progress } = await db
    .from("language_progress")
    .select("levels")
    .eq("learner_id", learnerId)
    .eq("language", "en")
    .maybeSingle();
  const levels = (progress?.levels ?? {}) as Record<string, number>;
  const target = Math.min(
    6,
    Math.max(levels.vocab ?? 0, levels.reading ?? 0) + 1,
  ) as Level;
  const targetLevel = LEVEL_LABELS.en[target];

  const r = await withGeminiKey((key) =>
    analyzeHomework(key, { base64: audio, mimeType }, image, targetLevel),
  );
  if (!r.ok)
    return NextResponse.json(
      { error: `${r.reason}，錄音先不用送，明天再錄就好` },
      { status: 503 },
    );
  if (!r.value.transcript && !r.value.words.length) {
    return NextResponse.json(
      { error: "沒聽到英文，靠近麥克風、戴耳機再錄一次" },
      { status: 422 },
    );
  }

  const row = {
    learner_id: learnerId,
    date,
    language: "en",
    content: r.value,
    practiced_at: null,
    extended_at: null,
  };
  let { error } = await db
    .from("class_homework")
    .upsert({ ...row, uploaded_by: userId });
  // 資料庫還沒加 uploaded_by 欄位（0012 還沒跑）時，先照舊存，只是不記誰代傳。
  if (error && /uploaded_by/.test(error.message))
    ({ error } = await db.from("class_homework").upsert(row));
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(r.value);
}
