// 學校／安親班英文作業：瀏覽器端錄音、上傳、讀回 AI 整理好的練習。

import { addDays, today } from "./dates";
import type { HomeworkContent } from "./gemini";
import { getSupabase } from "./supabase";

export type { HomeworkContent };

export interface Homework {
  date: string;
  content: HomeworkContent;
  practicedAt: string | null;
  extendedAt: string | null;
  /** 誰送的；跟孩子本人不同就是家長代傳。 */
  uploadedBy: string | null;
}

/** 錄音上限 3 分鐘。 */
export const HOMEWORK_MAX_SECONDS = 180;

/** 開始錄音；回傳 stop()，停止後拿到錄音。時間到會自動停。 */
export async function startRecording(
  onAutoStop: () => void,
): Promise<{ stop: () => Promise<Blob> }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => chunks.push(e.data);
  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
    };
  });
  const timer = setTimeout(() => {
    if (recorder.state !== "inactive") {
      recorder.stop();
      onAutoStop();
    }
  }, HOMEWORK_MAX_SECONDS * 1000);
  recorder.start();
  return {
    stop: () => {
      clearTimeout(timer);
      if (recorder.state !== "inactive") recorder.stop();
      return done;
    },
  };
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** 把照片縮到長邊 1280 px 的 JPEG，課本字還看得清楚，檔案也夠小。 */
export async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("照片處理失敗"))),
      "image/jpeg",
      0.8,
    ),
  );
}

export async function uploadHomework(
  learnerId: string,
  blob: Blob,
  photo?: Blob | null,
): Promise<HomeworkContent> {
  const { data } = await getSupabase().auth.getSession();
  const res = await fetch("/api/homework", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${data.session?.access_token ?? ""}`,
    },
    body: JSON.stringify({
      audio: await toBase64(blob),
      mimeType: blob.type,
      image: photo ? await toBase64(photo) : undefined,
      imageType: photo?.type,
      date: today(),
      learnerId,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "送出失敗，再試一次");
  return json as HomeworkContent;
}

/** 讀最近幾天（預設兩週）的作業，新的在前。 */
export async function recentHomework(learnerId: string, days = 14): Promise<Homework[]> {
  const read = (cols: string) =>
    getSupabase()
      .from("class_homework")
      .select(cols)
      .eq("learner_id", learnerId)
      .gte("date", addDays(today(), -days))
      .order("date", { ascending: false });
  let { data, error } = await read(
    "date, content, practiced_at, extended_at, uploaded_by",
  );
  // 0012 還沒跑、沒有 uploaded_by 欄位時，退回舊的欄位。
  if (error && /uploaded_by/.test(error.message))
    ({ data, error } = await read("date, content, practiced_at, extended_at"));
  if (error) throw error;
  return (
    (data ?? []) as unknown as {
      date: string;
      content: unknown;
      practiced_at: string | null;
      extended_at: string | null;
      uploaded_by?: string | null;
    }[]
  ).map((r) => ({
    date: r.date,
    content: r.content as HomeworkContent,
    practicedAt: r.practiced_at,
    extendedAt: r.extended_at,
    uploadedBy: r.uploaded_by ?? null,
  }));
}

export async function markDone(
  learnerId: string,
  date: string,
  part: "practiced_at" | "extended_at",
): Promise<void> {
  await getSupabase()
    .from("class_homework")
    .update({ [part]: new Date().toISOString() })
    .eq("learner_id", learnerId)
    .eq("date", date);
}

/** 今天的作業狀態：錄了沒、兩週內錄的有沒有還沒複習、還沒做延伸的、以前有沒有錄過（可做變化練習）。 */
export function homeworkStatus(list: Homework[], day = today()) {
  const recordedToday = list.some((h) => h.date === day);
  const fresh = list.filter((h) => h.date >= addDays(day, -14));
  const toPractice = fresh.find((h) => h.date < day && !h.practicedAt);
  const toExtend = fresh.find(
    (h) => h.date < day && !h.extendedAt && h.content.extension,
  );
  const hasPast = list.some((h) => h.date < day);
  return { recordedToday, toPractice, toExtend, hasPast };
}
