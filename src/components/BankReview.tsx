"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { FOCUS_NAMES, LANGUAGE_NAMES, LEVEL_LABELS, type FocusArea, type Language, type Level } from "@/lib/types";

interface Draft {
  id: number;
  language: Language;
  area: FocusArea;
  level: Level;
  kind: "mcq" | "sentence" | "pair";
  content: Record<string, unknown>;
  notebook: string | null;
}

function Preview({ d }: { d: Draft }) {
  const c = d.content;
  if (d.kind === "sentence") return <p>{String(c.text)}</p>;
  if (d.kind === "pair")
    return (
      <p>
        {String(c.term)} ＝ {String(c.meaning)}
      </p>
    );
  const choices = (Array.isArray(c.choices) ? c.choices : []).map(String);
  return (
    <div>
      <p>{String(c.q)}</p>
      <ol className="list-[upper-alpha] pl-6">
        {choices.map((ch, i) => (
          <li key={i} className={i === Number(c.answer) ? "font-semibold text-green-700 dark:text-green-400" : ""}>
            {ch}
          </li>
        ))}
      </ol>
      {Boolean(c.explain) && <p className="text-black/60 dark:text-white/60">{String(c.explain)}</p>}
    </div>
  );
}

/** Claude 審核後標「不確定」、指派給某位家人抽查的題目數。 */
export async function countBankChecks(checkerId: string): Promise<number> {
  const { count } = await getSupabase()
    .from("item_bank")
    .select("id", { count: "exact", head: true })
    .eq("status", "draft")
    .eq("content->review->>checker", checkerId);
  return count ?? 0;
}

/**
 * 題目抽查：NotebookLM 產出的題目由 Claude（資深教師角度）先審，確定的直接上線；
 * 不確定的英文題留在草稿、指派給家長當練習項目抽查。日文全交給 Claude。
 */
export function BankReview({ checkerId }: { checkerId: string }) {
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const { data, error } = await getSupabase()
      .from("item_bank")
      .select("id, language, area, level, kind, content, notebook")
      .eq("status", "draft")
      .eq("content->review->>checker", checkerId)
      .order("id")
      .limit(30);
    if (error) setError(error.message);
    setDrafts((data ?? []) as Draft[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkerId]);

  async function decide(ids: number[], status: "approved" | "rejected") {
    const { error } = await getSupabase().from("item_bank").update({ status, reviewed_at: new Date().toISOString() }).in("id", ids);
    if (error) setError(error.message);
    await load();
  }

  if (!drafts) return null;
  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">📝 幫忙抽查題目</h2>
        {drafts.length > 0 && (
          <button type="button" className="btn-ghost text-sm" onClick={() => decide(drafts.map((d) => d.id), "approved")}>
            這頁全部可以用
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {!drafts.length && <p className="text-sm text-black/60 dark:text-white/60">都看完了，謝謝！</p>}
      {drafts.map((d) => (
        <div key={d.id} className="flex items-start justify-between gap-3 border-t border-black/10 pt-2 text-sm dark:border-white/10">
          <div className="space-y-1">
            <p className="text-xs text-black/50 dark:text-white/50">
              {LANGUAGE_NAMES[d.language]}・{FOCUS_NAMES[d.area]}・{LEVEL_LABELS[d.language][d.level]}
              {d.notebook ? `・${d.notebook}` : ""}
            </p>
            <Preview d={d} />
            {Boolean((d.content.review as { note?: string } | undefined)?.note) && (
              <p className="text-amber-700 dark:text-amber-400">
                Claude 不確定的地方：{String((d.content.review as { note?: string }).note)}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-1">
            <button type="button" className="btn-ghost text-sm" onClick={() => decide([d.id], "approved")}>
              ✅ 可以用
            </button>
            <button type="button" className="btn-ghost text-sm text-red-700 dark:text-red-400" onClick={() => decide([d.id], "rejected")}>
              ✖
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
