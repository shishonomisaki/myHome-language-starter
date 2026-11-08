// 小遊戲題型：拼句（點字塊排順序）、配對、字母重組、聽寫。題目由 AI 出，判分在這裡。

import { shuffle } from "./quiz";
import type { Language } from "./types";

/** 日文拼句的答案去掉分塊用的空白。 */
export function joinChunks(chunks: string[], language: Language): string {
  return chunks.join(language === "en" ? " " : "");
}

/** 拼句：用空白切塊。日文題目出題時就用空白分好文節（例：「私は 学生 です。」）。 */
export function sentenceChunks(sentence: string): string[] {
  return sentence.trim().split(/[\s\u3000]+/).filter(Boolean);
}

/** 打亂順序，保證不會剛好是原本的順序（兩塊以上時）。 */
export function scrambled<T>(items: T[]): T[] {
  if (items.length < 2) return [...items];
  for (let i = 0; i < 10; i++) {
    const s = shuffle(items);
    if (s.some((x, j) => x !== items[j])) return s;
  }
  return [...items.slice(1), items[0]];
}

/** 字母重組：只用英文單字（日文就不出這題）。 */
export function letterTiles(word: string): string[] {
  return scrambled(word.split(""));
}

/** 比對答案：忽略大小寫、前後空白、多餘空白與句尾標點。 */
export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s　]+/g, " ")
    .replace(/[.,!?。、！？'"’]/g, "")
    .trim();
}

export function sameAnswer(a: string, b: string): boolean {
  return normalizeAnswer(a) === normalizeAnswer(b);
}

/** 聽寫給部分分數：以字（英文）或字元（日文）計算答對比例。 */
export function dictationScore(typed: string, target: string, language: Language): number {
  const t = normalizeAnswer(target);
  const y = normalizeAnswer(typed);
  if (!t) return 0;
  const a = language === "en" ? t.split(" ") : [...t.replace(/ /g, "")];
  const b = language === "en" ? y.split(" ") : [...y.replace(/ /g, "")];
  // 最長共同子序列，順序對才算。
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return dp[a.length][b.length] / Math.max(a.length, b.length);
}

type Pair = { term: string; meaning: string; pos?: string; example?: string };

/** 詞性放在中文後面：「影響（動詞）」。已經標過就不重複。 */
export function withPos(p: Pair): string {
  if (!p.pos || /[（(][^）)]*[）)]/.test(p.meaning)) return p.meaning;
  return `${p.meaning}（${posName(p.pos)}）`;
}

/** 比對中文意思用：去掉詞性標記（名／動／n.／v.…）、括號、標點與空白。 */
function meaningKey(m: string): string {
  return m
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/\b(n|v|adj|adv|prep|conj|phr)\./gi, "")
    .replace(/[\s　、，,;；/／。.!！?？~～]/g, "")
    .trim();
}

/** 兩個意思會不會讓人分不出來：去掉標記後一樣，或一個包含另一個（影響 vs 影響力）。 */
export function confusableMeanings(a: string, b: string): boolean {
  const x = meaningKey(a);
  const y = meaningKey(b);
  if (!x || !y) return a.trim() === b.trim();
  return x === y || (Math.min(x.length, y.length) >= 2 && (x.includes(y) || y.includes(x)));
}

/** 找出同一組裡意思撞在一起的配對（給驗證／測試用）。 */
export function ambiguousPairs(pairs: Pair[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < pairs.length; i++)
    for (let j = i + 1; j < pairs.length; j++)
      if (pairs[i].meaning.trim() === pairs[j].meaning.trim() || (confusableMeanings(pairs[i].meaning, pairs[j].meaning) && !distinctLabels(pairs[i].meaning, pairs[j].meaning)))
        out.push([i, j]);
  return out;
}

/** 已經有括號提示而且兩邊提示不同，就算標清楚了。 */
function distinctLabels(a: string, b: string): boolean {
  const tag = (m: string) => (m.match(/[（(][^）)]*[）)]/g) ?? []).join("");
  return !!tag(a) && !!tag(b) && tag(a) !== tag(b);
}

/**
 * 配對題的意思一定要分得出來（effect / affect 都寫「影響」不行）。
 * 不刪題，只把撞在一起的意思補上提示：「影響（a 開頭）」「影響（e 開頭）」。
 * 存檔前（AI／題庫）與畫面顯示前都會跑，舊資料也會被補上。
 */
export function labelAmbiguousPairs(pairs: Pair[]): Pair[] {
  const out = pairs.map((p) => ({ ...p, meaning: withPos(p) }));
  const clash = ambiguousPairs(out);
  const prefix: Record<number, number> = {};
  for (const [i, j] of clash) {
    const a = out[i].term.trim().toLowerCase();
    const b = out[j].term.trim().toLowerCase();
    let k = 1;
    while (k < Math.max(a.length, b.length) && a.slice(0, k) === b.slice(0, k)) k++;
    prefix[i] = Math.max(prefix[i] ?? 1, k);
    prefix[j] = Math.max(prefix[j] ?? 1, k);
  }
  for (const key of Object.keys(prefix)) {
    const i = Number(key);
    const t = out[i].term.trim();
    const p = t.slice(0, prefix[i]);
    out[i].meaning = `${out[i].meaning}（${p}${p.length < t.length ? "…" : ""} 開頭）`;
  }
  return out;
}

/** 易混字：意思撞在一起的那幾組（用原始意思判斷，給「先分清楚」教學卡）。 */
export function confusableGroups(pairs: Pair[]): number[][] {
  const groups: number[][] = [];
  for (let i = 0; i < pairs.length; i++)
    for (let j = i + 1; j < pairs.length; j++) {
      if (!confusableMeanings(pairs[i].meaning, pairs[j].meaning)) continue;
      const g = groups.find((x) => x.includes(i) || x.includes(j));
      if (g) [i, j].forEach((k) => !g.includes(k) && g.push(k));
      else groups.push([i, j]);
    }
  return groups;
}

/** 例句挖空：把那個字換成 ___（找不到就回傳 null）。 */
export function blankOut(example: string, term: string): string | null {
  const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return re.test(example) ? example.replace(re, "___") : null;
}

const POS_NAMES: Record<string, string> = { 名: "名詞", 動: "動詞", 形: "形容詞", 副: "副詞", n: "名詞", v: "動詞", adj: "形容詞", adv: "副詞" };
export function posName(pos: string): string {
  const k = pos.trim().replace(/[.()（）]/g, "");
  return POS_NAMES[k] ?? POS_NAMES[k.toLowerCase()] ?? k;
}

/** 什麼情況用哪種詞性（易混字教學卡用）。 */
export const POS_TIPS: Record<string, string> = {
  名詞: "名詞＝一件事／東西：放在 a、an、the、my、形容詞後面，或當主詞（例：a good effect、my advice）。",
  動詞: "動詞＝一個動作：放在主詞後面，或 can、will、to 後面（例：Rain can affect the game. I advise you to rest.）。",
  形容詞: "形容詞＝形容東西：放在名詞前面，或 is、am、are 後面（例：a quiet room、She is quiet.）。",
  副詞: "副詞＝形容動作：常放在動詞後面（例：Speak quietly.）。",
};
