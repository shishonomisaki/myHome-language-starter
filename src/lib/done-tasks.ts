// 今天哪些練習項目已經做完：存在資料庫（done_tasks），換裝置或家長登入都看得到。

/** 一個項目的識別：種類＋語言＋（強化項目）。 */
export function taskKey(kind: string, language: string, area?: string | null) {
  return [kind, language, area ?? ""].join("|");
}

/** 從練習頁網址推回是哪一個項目，例如 /learn/kid1/vocab?mode=review&lang=en。 */
export function taskKeyFromUrl(pathname: string, search: string): string | null {
  const seg = pathname.split("/").filter(Boolean).pop();
  if (!seg) return null;
  const q = new URLSearchParams(search);
  const lang = q.get("lang");
  if (!lang) return null;
  const mode = q.get("mode");
  let kind = seg;
  if (seg === "vocab") kind = mode === "review" ? "review" : "vocab";
  else if (seg === "homework" && (mode === "practice" || mode === "extend")) kind = `homework-${mode}`;
  // 舊作業變化練習借用強化單元的頁面。
  else if (seg === "focus" && q.get("area") === "homework") return taskKey("homework-mix", lang);
  return taskKey(kind, lang, q.get("area"));
}

/** 目前練習頁對應的項目（伺服器端或網址不對時回 null）。 */
export function currentTaskKey(): string | null {
  if (typeof window === "undefined") return null;
  return taskKeyFromUrl(window.location.pathname, window.location.search);
}
