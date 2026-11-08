// 作文批改：Gemini 以資深 ESL 老師身份依英檢寫作四面向評分，給逐句修改、講評、改進建議。
// POST 批改並存檔；PUT 在背景請第二位 AI 考官只評分數，差超過 10 分就標記等 Claude 複評。

import { NextResponse } from "next/server";
import { withGeminiKey } from "@/lib/ai-server";
import { today } from "@/lib/dates";
import { needsRegrade } from "@/lib/essay";
import { checkScore, gradeEssay, type EssayTask } from "@/lib/essay-grade";
import type { Image } from "@/lib/gemini";
import { LEVEL_LABELS, type Level } from "@/lib/types";
import { requireUser, serviceClient } from "@/lib/supabase-server";

const MAX_TEXT = 6000;
/** 照片在瀏覽器先縮小，通常 200–400 KB。 */
const MAX_IMAGE_BASE64 = 1_200_000;

export const maxDuration = 60;

type Db = ReturnType<typeof serviceClient>;

/** 本人，或管理者幫家人送。回傳要算在誰名下，或錯誤。 */
async function resolveLearner(db: Db, userId: string, asked: string) {
  if (!asked || asked === userId) return { learnerId: userId };
  const { data: me } = await db.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (me?.role !== "admin") return { error: "只有爸媽的帳號可以幫家人送作文", status: 403 };
  return { learnerId: asked };
}

async function taskInfo(db: Db, learnerId: string) {
  const { data: p } = await db.from("profiles").select("role").eq("id", learnerId).maybeSingle();
  const { data: progress } = await db
    .from("language_progress")
    .select("levels")
    .eq("learner_id", learnerId)
    .eq("language", "en")
    .maybeSingle();
  const levels = (progress?.levels ?? {}) as Record<string, number>;
  // 寫作看文法和字彙，取較高的那項當目標級數。
  const level = Math.min(6, Math.max(levels.grammar ?? 0, levels.vocab ?? 0)) as Level;
  return { kid: p?.role !== "admin", level: LEVEL_LABELS.en[level] };
}

export async function POST(req: Request) {
  const userId = await requireUser(req);
  if (!userId) return NextResponse.json({ error: "請先登入" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const text = String(body?.text ?? "").trim();
  const title = String(body?.title ?? "").trim().slice(0, 200);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.date)) ? String(body.date) : today();
  if (text.length > MAX_TEXT) return NextResponse.json({ error: "作文太長了" }, { status: 413 });

  const imageData = String(body?.image ?? "");
  const imageType = String(body?.imageType ?? "");
  let image: Image | undefined;
  if (imageData) {
    if (!/^image\/(jpeg|png|webp)$/.test(imageType)) return NextResponse.json({ error: "照片格式不對" }, { status: 400 });
    if (imageData.length > MAX_IMAGE_BASE64) return NextResponse.json({ error: "照片太大" }, { status: 413 });
    image = { base64: imageData, mimeType: imageType };
  }
  if (!image && text.split(/\s+/).length < 3)
    return NextResponse.json({ error: "多寫幾個英文字再送出" }, { status: 400 });

  const db = serviceClient();
  const who = await resolveLearner(db, userId, String(body?.learnerId ?? ""));
  if ("error" in who) return NextResponse.json({ error: who.error }, { status: who.status });
  const info = await taskInfo(db, who.learnerId);
  const task: EssayTask = { title, level: info.level, kid: info.kid, text, image };

  const r = await withGeminiKey((call) => gradeEssay(call, task));
  if (!r.ok) return NextResponse.json({ error: `${r.reason}，作文先存著，晚點再送` }, { status: 503 });
  const feedback = r.value;
  if (!feedback.text)
    return NextResponse.json({ error: image ? "照片裡看不到英文字，拍清楚一點再試" : "看不到英文作文" }, { status: 422 });

  // 照片不存，只存辨識出的文字和批改。資料表還沒建（0019 還沒跑）也照樣回批改結果。
  const { data, error } = await db
    .from("essays")
    .insert({
      learner_id: who.learnerId,
      written_on: date,
      language: "en",
      title,
      body: feedback.text.slice(0, MAX_TEXT),
      score: feedback.score,
      feedback,
    })
    .select("id")
    .single();
  if (error) console.error("essay save failed", error.message);
  return NextResponse.json({ id: data?.id ?? null, feedback, saved: !error });
}

export async function PUT(req: Request) {
  const userId = await requireUser(req);
  if (!userId) return NextResponse.json({ error: "請先登入" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "缺少作文" }, { status: 400 });
  const db = serviceClient();
  const { data: row } = await db.from("essays").select("learner_id, title, body, score, feedback").eq("id", id).maybeSingle();
  if (!row) return NextResponse.json({ error: "找不到這篇" }, { status: 404 });
  if (row.learner_id !== userId) {
    const { data: me } = await db.from("profiles").select("role").eq("id", userId).maybeSingle();
    if (me?.role !== "admin") return NextResponse.json({ error: "不能看別人的作文" }, { status: 403 });
  }
  if (row.feedback?.checkScore !== undefined) return NextResponse.json({ needsReview: !!row.feedback.needsReview });
  const info = await taskInfo(db, row.learner_id);
  const r = await withGeminiKey((call) =>
    checkScore(call, { title: row.title, level: info.level, kid: info.kid, text: row.body }, row.body),
  );
  // 第二次評分失敗不影響已給的回饋，下次再說。
  if (!r.ok) return NextResponse.json({ needsReview: false, skipped: r.reason });
  const review = needsRegrade(row.score, r.value);
  await db
    .from("essays")
    .update({ needs_review: review, feedback: { ...row.feedback, checkScore: r.value, needsReview: review } })
    .eq("id", id);
  return NextResponse.json({ needsReview: review, checkScore: r.value });
}
