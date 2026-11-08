"use client";

import { SpeakText } from "@/components/SpeakText";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLearner } from "@/components/useLearner";
import { addDays, today } from "@/lib/dates";
import { ESSAY_DIMENSIONS, essayPrompts, wordCount, type EssayFeedback } from "@/lib/essay";
import { shrinkPhoto } from "@/lib/homework";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import type { Level } from "@/lib/types";

type Saved = { id: number; written_on: string; title: string; score: number; feedback: EssayFeedback };

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function authHeaders() {
  const { data } = await getSupabase().auth.getSession();
  return { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` };
}

function scoreColor(s: number) {
  return s >= 80 ? "text-teal-700 dark:text-teal-300" : s >= 60 ? "text-amber-600 dark:text-amber-300" : "text-red-600 dark:text-red-400";
}

/** 批改結果：分數、四面向、逐句修改、講評、改進建議、改寫範例。 */
function FeedbackView({ f }: { f: EssayFeedback }) {
  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3">
        <span className={`text-4xl font-bold ${scoreColor(f.score)}`}>{f.score}</span>
        <span className="text-sm text-black/60 dark:text-white/60">/ 100（英檢寫作四面向）</span>
      </div>
      {f.needsReview && (
        <p className="rounded-lg bg-sky-50 p-2 text-sm text-sky-900 dark:bg-sky-900/30 dark:text-sky-100">
          兩位 AI 考官給的分數差比較多，Claude 老師會再幫你複評一次。
        </p>
      )}
      <ul className="grid gap-2 sm:grid-cols-2">
        {ESSAY_DIMENSIONS.map((d) => (
          <li key={d.key} className="rounded-lg bg-black/5 p-2 text-sm dark:bg-white/10">
            <div className="flex justify-between font-semibold">
              <span>{d.name}</span>
              <span>{"★".repeat(f.bands[d.key])}{"☆".repeat(5 - f.bands[d.key])}</span>
            </div>
            <p className="mt-1">{f.notes[d.key]}</p>
          </li>
        ))}
      </ul>
      {f.comment && (
        <section>
          <h3 className="font-semibold">🧑‍🏫 老師講評</h3>
          <p className="mt-1">{f.comment}</p>
        </section>
      )}
      {f.edits.length > 0 && (
        <section>
          <h3 className="font-semibold">✏️ 逐句修改</h3>
          <ol className="mt-1 space-y-2">
            {f.edits.map((e, i) => (
              <li key={i} className="rounded-lg border border-black/10 p-2 text-sm dark:border-white/10">
                <p className="text-red-600 line-through dark:text-red-400">{e.original}</p>
                <p className="font-medium text-teal-700 dark:text-teal-300"><SpeakText text={e.corrected} language="en" /></p>
                <p className="text-black/60 dark:text-white/60">{e.why}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
      {f.tips.length > 0 && (
        <section>
          <h3 className="font-semibold">🎯 下次可以練</h3>
          <ul className="mt-1 list-disc pl-5">
            {f.tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
      )}
      {f.rewrite && (
        <details className="rounded-lg bg-black/5 p-2 dark:bg-white/10">
          <summary className="cursor-pointer font-semibold">📖 看老師的改寫範例</summary>
          <p className="mt-2 whitespace-pre-wrap"><SpeakText text={f.rewrite} language="en" place="read" /></p>
        </details>
      )}
    </div>
  );
}

export default function EssayPage() {
  const { learner, repo } = useLearner();
  const [level, setLevel] = useState<Level>(0);
  const [promptId, setPromptId] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<EssayFeedback | null>(null);
  const [history, setHistory] = useState<Saved[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const started = useRef(Date.now());

  const adult = learner?.role === "admin";
  const prompts = useMemo(() => essayPrompts(level, adult), [level, adult]);
  const chosen = prompts.find((p) => p.id === promptId);
  const photoUrl = useMemo(() => (photo ? URL.createObjectURL(photo) : ""), [photo]);
  const thisWeek = history.filter((h) => h.written_on > addDays(today(), -7)).length;

  useEffect(() => {
    if (!learner) return;
    repo.getProgress(learner.id, "en").then((p) => setLevel(Math.max(p.levels.grammar, p.levels.vocab) as Level));
    if (!supabaseConfigured) return;
    getSupabase()
      .from("essays")
      .select("id, written_on, title, score, feedback")
      .eq("learner_id", learner.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setHistory((data ?? []) as Saved[]));
  }, [learner, repo]);

  if (learner === null) return <p>找不到這位家人。</p>;
  if (!learner) return <p>載入中…</p>;

  function pick(id: string) {
    setPromptId(id);
    setTitle(prompts.find((p) => p.id === id)?.title ?? "");
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      setPhoto(await shrinkPhoto(file));
    } catch {
      setError("這張照片讀不到，換一張試試");
    }
  }

  async function send() {
    if (!learner) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/essay", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          learnerId: learner.id,
          title,
          text,
          image: photo ? await toBase64(photo) : undefined,
          imageType: photo?.type,
          date: today(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "送出失敗，再試一次");
      const f = json.feedback as EssayFeedback;
      setResult(f);
      const minutes = Math.min(30, Math.max(1, Math.round((Date.now() - started.current) / 60000)));
      await repo.addMinutes(learner.id, today(), minutes).catch(() => {});
      if (json.id) {
        setHistory((h) => [{ id: json.id, written_on: today(), title, score: f.score, feedback: f }, ...h]);
        // 第二位 AI 考官在背景只評分數，不用等。
        fetch("/api/essay", { method: "PUT", headers: await authHeaders(), body: JSON.stringify({ id: json.id }) })
          .then((r) => r.json())
          .then((j) => j?.needsReview && setResult((r) => (r ? { ...r, needsReview: true } : r)))
          .catch(() => {});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "送出失敗，再試一次");
    } finally {
      setBusy(false);
    }
  }

  function again() {
    setResult(null);
    setText("");
    setPhoto(null);
    setPromptId("");
    setTitle("");
    started.current = Date.now();
  }

  const words = wordCount(text);
  const canSend = !busy && (photo || words >= 3);

  return (
    <div className="space-y-4">
      <section className="card space-y-2">
        <h1 className="text-xl font-bold">✍️ 英文作文</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          {adult
            ? "自由選題，想寫就寫；要挑戰升級時，寫作要拿到 80 分。"
            : `每週寫一段就好（這週已寫 ${thisWeek} 篇）。可以打字，也可以拍手寫的照片。`}
        </p>
      </section>

      {result ? (
        <section className="card space-y-4">
          <FeedbackView f={result} />
          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={again}>
              再寫一篇
            </button>
            <Link href={`/learn/${learner.id}`} className="btn-ghost">
              回到今天的清單
            </Link>
          </div>
        </section>
      ) : (
        <section className="card space-y-3">
          <h2 className="font-semibold">1. 選題目</h2>
          <div className="flex flex-wrap gap-2">
            {prompts.map((p) => (
              <button
                key={p.id}
                className={promptId === p.id ? "btn text-sm" : "btn-ghost text-sm"}
                onClick={() => pick(p.id)}
              >
                {p.title || "自由題"}
              </button>
            ))}
          </div>
          {chosen && (
            <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
              {chosen.hint}（{chosen.target}）
            </p>
          )}
          <input
            className="w-full rounded-lg border border-black/20 bg-transparent p-2 dark:border-white/20"
            placeholder="標題（英文）"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <h2 className="font-semibold">2. 寫作文</h2>
          <textarea
            className="min-h-48 w-full rounded-lg border border-black/20 bg-transparent p-2 dark:border-white/20"
            placeholder="Write in English here…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!!photo}
            spellCheck={false}
            autoCorrect="off"
          />
          <p className="text-xs text-black/50 dark:text-white/50">{words} 字</p>
          <div className="space-y-2">
            <label className="btn-ghost inline-block cursor-pointer text-sm">
              📷 {photo ? "換一張照片" : "或拍手寫稿"}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
            </label>
            {photo && (
              <div className="space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="手寫作文" className="max-h-64 rounded-lg" />
                <button className="text-xs underline" onClick={() => setPhoto(null)}>
                  不用照片，改用打字
                </button>
                <p className="text-xs text-black/50 dark:text-white/50">照片只拿來辨識文字，不會存起來。</p>
              </div>
            )}
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button className="btn w-full text-lg" disabled={!canSend} onClick={send}>
            {busy ? "AI 老師批改中…（約 10–30 秒）" : "3. 送出批改"}
          </button>
        </section>
      )}

      {history.length > 0 && (
        <section className="card space-y-2">
          <h2 className="font-semibold">我寫過的作文</h2>
          <ul className="divide-y divide-black/10 dark:divide-white/10">
            {history.map((h) => (
              <li key={h.id} className="py-2">
                <button className="flex w-full justify-between text-left" onClick={() => setOpen(open === h.id ? null : h.id)}>
                  <span>
                    <span className="mr-2 text-xs text-black/50 dark:text-white/50">{h.written_on}</span>
                    {h.title || "（自由題）"}
                  </span>
                  <span className={`font-semibold ${scoreColor(h.score)}`}>{h.score}</span>
                </button>
                {open === h.id && (
                  <div className="mt-2 space-y-3">
                    <p className="whitespace-pre-wrap rounded-lg bg-black/5 p-2 text-sm dark:bg-white/10">{h.feedback.text}</p>
                    <FeedbackView f={h.feedback} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
