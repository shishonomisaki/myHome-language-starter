// 拼寫拆解：字首、字尾（含詞性）、常見字母組合、大約的音節。用來把單字拆成好記的小塊。

import type { WordPart } from "./types";

export interface Affix {
  text: string;
  meaning: string;
  /** 字尾通常決定詞性。 */
  pos?: string;
}

export const PREFIXES: Affix[] = [
  { text: "inter", meaning: "在…之間" },
  { text: "under", meaning: "在下、不足" },
  { text: "over", meaning: "過度、在上" },
  { text: "trans", meaning: "跨越" },
  { text: "super", meaning: "超" },
  { text: "anti", meaning: "反" },
  { text: "dis", meaning: "不、相反" },
  { text: "mis", meaning: "錯誤" },
  { text: "pre", meaning: "之前" },
  { text: "com", meaning: "一起" },
  { text: "con", meaning: "一起" },
  { text: "un", meaning: "不" },
  { text: "re", meaning: "再、回" },
  { text: "ex", meaning: "向外" },
  { text: "in", meaning: "不；向內" },
  { text: "im", meaning: "不；向內" },
];

export const SUFFIXES: Affix[] = [
  { text: "ation", meaning: "動作或結果", pos: "名詞" },
  { text: "tion", meaning: "動作或結果", pos: "名詞" },
  { text: "sion", meaning: "動作或結果", pos: "名詞" },
  { text: "ment", meaning: "結果、狀態", pos: "名詞" },
  { text: "ness", meaning: "性質、狀態", pos: "名詞" },
  { text: "ity", meaning: "性質", pos: "名詞" },
  { text: "ence", meaning: "性質、狀態", pos: "名詞" },
  { text: "ance", meaning: "性質、狀態", pos: "名詞" },
  { text: "ship", meaning: "關係、身分", pos: "名詞" },
  { text: "ist", meaning: "…的人", pos: "名詞" },
  { text: "er", meaning: "…的人或東西；比較級", pos: "名詞／比較級" },
  { text: "or", meaning: "…的人或東西", pos: "名詞" },
  { text: "able", meaning: "可以…的", pos: "形容詞" },
  { text: "ible", meaning: "可以…的", pos: "形容詞" },
  { text: "ful", meaning: "充滿…的", pos: "形容詞" },
  { text: "less", meaning: "沒有…的", pos: "形容詞" },
  { text: "ous", meaning: "有…性質的", pos: "形容詞" },
  { text: "ive", meaning: "有…傾向的", pos: "形容詞" },
  { text: "al", meaning: "與…有關的", pos: "形容詞" },
  { text: "ic", meaning: "與…有關的", pos: "形容詞" },
  { text: "ent", meaning: "…的", pos: "形容詞" },
  { text: "ant", meaning: "…的", pos: "形容詞" },
  { text: "ly", meaning: "…地", pos: "副詞" },
  { text: "ize", meaning: "使…化", pos: "動詞" },
  { text: "ate", meaning: "使…；做…", pos: "動詞" },
  { text: "ing", meaning: "正在；動名詞", pos: "動詞變化" },
  { text: "ed", meaning: "過去式", pos: "動詞變化" },
];

/** 常見字母組合：拼字時當成一塊記。長的放前面。 */
export const COMBOS = [
  "tion", "sion", "ough", "augh", "eigh", "ight", "tch", "dge", "igh", "qu",
  "ph", "ck", "sh", "ch", "th", "wh", "ng", "kn", "wr",
  "ee", "ea", "oo", "ai", "ay", "ou", "ow", "oa", "oi", "oy", "ie", "ei", "au", "aw", "ew",
  "ar", "er", "ir", "or", "ur",
];

const VOWEL = /[aeiouy]/;

export interface WordParts {
  prefix?: Affix;
  suffix?: Affix;
  /** 拼字塊：字首、音節、字尾依序排好，合起來就是原字。 */
  chunks: string[];
  /** 這個字裡出現的常見字母組合。 */
  combos: string[];
}

/** 把字根切成大約的音節：母音群為核心，母音間的子音一個留給下一節（VCV→V-CV），兩個以上對半分（VCCV→VC-CV），常見組合不拆開。 */
export function syllables(root: string): string[] {
  // tion、sion 自成一塊。
  const m = /^(.+?)(tion|sion)(.*)$/i.exec(root);
  if (m && m[1].length) return [...syllables(m[1]), m[2], ...(m[3] ? syllables(m[3]) : [])];
  const w = root.toLowerCase();
  // 先切成「單位」：常見組合當一個單位，其他每個字母一個。
  const units: string[] = [];
  for (let i = 0; i < w.length; ) {
    const combo = COMBOS.find((c) => c.length > 1 && w.startsWith(c, i) && !/^(ar|er|ir|or|ur)$/.test(c));
    const u = combo ?? w[i];
    units.push(u);
    i += u.length;
  }
  const isV = (u: string) => VOWEL.test(u[0]) && !/^(qu)$/.test(u);
  const nuclei = units.map((u, i) => (isV(u) ? i : -1)).filter((i) => i >= 0);
  // 字尾不發音的 e 不算一個音節。
  if (nuclei.length > 1 && units[units.length - 1] === "e" && !isV(units[units.length - 2] ?? "")) nuclei.pop();
  if (nuclei.length <= 1) return [root];
  const cuts: number[] = [];
  for (let k = 0; k < nuclei.length - 1; k++) {
    const between = nuclei[k + 1] - nuclei[k] - 1;
    if (between === 0) continue; // 兩個母音相鄰但不同單位，不切
    cuts.push(nuclei[k] + 1 + (between >= 2 ? Math.floor(between / 2) : 0));
  }
  const out: string[] = [];
  let start = 0;
  for (const c of cuts) {
    out.push(units.slice(start, c).join(""));
    start = c;
  }
  out.push(units.slice(start).join(""));
  // 保留原字的大小寫位置
  let pos = 0;
  return out.filter(Boolean).map((s) => {
    const r = root.slice(pos, pos + s.length);
    pos += s.length;
    return r;
  });
}

export function analyzeWord(word: string): WordParts {
  const w = word.toLowerCase();
  // 字首、字尾要留下至少 3 個字母的字根，才算數。
  const prefix = PREFIXES.find((p) => w.startsWith(p.text) && w.length - p.text.length >= 4);
  const rest = prefix ? w.slice(prefix.text.length) : w;
  // 短字尾（2 個字母）容易誤判，字根要更長才算。
  const suffix = SUFFIXES.find((s) => rest.endsWith(s.text) && rest.length - s.text.length >= (s.text.length <= 2 ? 4 : 3));
  const rootStart = prefix?.text.length ?? 0;
  const rootEnd = word.length - (suffix?.text.length ?? 0);
  const root = word.slice(rootStart, rootEnd);
  const chunks = [
    ...(prefix ? [word.slice(0, rootStart)] : []),
    ...syllables(root),
    ...(suffix ? [word.slice(rootEnd)] : []),
  ];
  const combos = COMBOS.filter((c) => c.length > 1 && w.includes(c)).filter(
    (c, _, all) => !all.some((o) => o !== c && o.length > c.length && o.includes(c) && w.includes(o)),
  );
  return { prefix, suffix, chunks, combos: combos.slice(0, 3) };
}

/** 字根：字中間常見、有固定意思的部分（多半來自拉丁文、希臘文）。只收 4 個字母以上或不容易誤判的。 */
export interface Root {
  text: string;
  meaning: string;
  examples: string[];
}

export const ROOTS: Root[] = [
  { text: "struct", meaning: "建造", examples: ["structure", "instruct"] },
  { text: "script", meaning: "寫", examples: ["description", "script"] },
  { text: "scrib", meaning: "寫", examples: ["describe", "subscribe"] },
  { text: "spect", meaning: "看", examples: ["inspect", "respect"] },
  { text: "graph", meaning: "寫、畫", examples: ["photograph", "paragraph"] },
  { text: "tract", meaning: "拉", examples: ["attract", "tractor"] },
  { text: "press", meaning: "壓", examples: ["express", "pressure"] },
  { text: "photo", meaning: "光", examples: ["photograph"] },
  { text: "micro", meaning: "很小", examples: ["microphone", "microwave"] },
  { text: "cycl", meaning: "圈、輪", examples: ["bicycle", "recycle"] },
  { text: "dict", meaning: "說", examples: ["dictionary", "predict"] },
  { text: "duct", meaning: "引導", examples: ["product", "conduct"] },
  { text: "fect", meaning: "做", examples: ["perfect", "effect"] },
  { text: "fact", meaning: "做", examples: ["factory", "manufacture"] },
  { text: "form", meaning: "形狀", examples: ["uniform", "information"] },
  { text: "ject", meaning: "丟、投", examples: ["project", "subject"] },
  { text: "manu", meaning: "手", examples: ["manual", "manufacture"] },
  { text: "pend", meaning: "掛", examples: ["depend", "independent"] },
  { text: "port", meaning: "搬運", examples: ["import", "transport"] },
  { text: "rupt", meaning: "破", examples: ["interrupt", "erupt"] },
  { text: "spir", meaning: "呼吸", examples: ["inspire", "spirit"] },
  { text: "tele", meaning: "遠", examples: ["telephone", "television"] },
  { text: "vent", meaning: "來", examples: ["event", "adventure"] },
  { text: "vers", meaning: "轉", examples: ["universe", "conversation"] },
  { text: "vert", meaning: "轉", examples: ["advertise", "convert"] },
  { text: "auto", meaning: "自己", examples: ["automatic"] },
  { text: "phon", meaning: "聲音", examples: ["telephone", "microphone"] },
  { text: "aud", meaning: "聽", examples: ["audio", "audience"] },
  { text: "vis", meaning: "看", examples: ["visit", "television"] },
  { text: "vid", meaning: "看", examples: ["video", "evidence"] },
  { text: "bio", meaning: "生命", examples: ["biology"] },
  { text: "geo", meaning: "土地", examples: ["geography"] },
  { text: "mot", meaning: "動", examples: ["motor", "emotion"] },
  { text: "mov", meaning: "動", examples: ["move", "remove"] },
  { text: "voc", meaning: "聲音、叫", examples: ["vocabulary", "advocate"] },
];

/** 找出字中的字根（字根本身不能就是整個字）。長的優先，重疊的只留一個。 */
export function findRoots(word: string): Root[] {
  const w = word.toLowerCase();
  const taken: [number, number][] = [];
  const out: Root[] = [];
  for (const r of [...ROOTS].sort((a, b) => b.text.length - a.text.length)) {
    if (w.length <= r.text.length + 1) continue;
    const at = w.indexOf(r.text);
    if (at < 0) continue;
    const end = at + r.text.length;
    if (taken.some(([s, e]) => at < e && end > s)) continue;
    taken.push([at, end]);
    out.push(r);
  }
  return out.slice(0, 2);
}

/**
 * 拼字提示：錯越多次給越多。
 * 0 次：只給第一個字母；1 次起：拼對過的塊直接顯示；2 次起：每塊給第一個字母；3 次起：每塊再給最後一個字母。
 */
export function hintPattern(chunks: string[], misses: number, known: ReadonlySet<number> = new Set()): string[] {
  return chunks.map((c, i) => {
    if (known.has(i)) return c;
    const first = i === 0 || misses >= 2;
    const last = misses >= 3 && c.length >= 3;
    return [...c].map((ch, j) => ((j === 0 && first) || (j === c.length - 1 && last) ? ch : "_")).join("");
  });
}

/** 拆字的部分去掉連字號，例如 pre- → pre。 */
export const partText = (p: WordPart) => p.text.replace(/-/g, "");

/** 拼字塊：有整理過的字首字根字尾就照它切（太長的字根再切音節），沒有或對不上原字就用自動拆解。 */
export function spellChunks(word: string, parts?: WordPart[]): string[] {
  if (!parts?.length || parts.map(partText).join("").toLowerCase() !== word.toLowerCase()) return analyzeWord(word).chunks;
  let pos = 0;
  return parts.flatMap((p) => {
    const t = word.slice(pos, pos + partText(p).length);
    pos += t.length;
    return p.kind === "root" && t.length > 6 ? syllables(t) : [t];
  });
}

/** 詞性（名詞、動詞…）加括號，例如 (動詞)；其他意思照原樣。 */
export function partMeaning(meaning: string): string {
  return /^(名詞|動詞|形容詞|副詞|介系詞|連接詞|代名詞)$/.test(meaning) ? `(${meaning})` : meaning;
}

/** 每個拆解的部分對應到哪幾個拼字塊（依字元位置），亮燈時用：唸到哪一塊，對應的泡泡就亮。 */
export function partChunkIndexes(chunks: string[], parts: WordPart[]): number[][] {
  const bounds: [number, number][] = [];
  let at = 0;
  for (const c of chunks) {
    bounds.push([at, at + c.length]);
    at += c.length;
  }
  let pos = 0;
  return parts.map((p) => {
    const from = pos;
    pos += partText(p).length;
    return bounds.flatMap(([a, b], i) => (a < pos && b > from ? [i] : []));
  });
}

/** 一行看完拆解：pre-（之前）＋ dict（說）＋ -ion（名詞）。 */
export function partsLabel(parts: WordPart[]): string {
  return parts.map((p) => `${p.text}（${p.meaning}）`).join(" ＋ ");
}

/**
 * 拼錯時找出差在哪：開頭和結尾各有幾個字母對（不分大小寫），中間那段就是要補的地方。
 * 例如 available 打成 aable：head 1、tail 4，中間少了 vail 4 個字母。
 */
export function spellDiff(typed: string, word: string): { head: number; tail: number; middle: string; gap: number } {
  const t = typed.toLowerCase();
  const w = word.toLowerCase();
  const max = Math.min(t.length, w.length);
  let head = 0;
  while (head < max && t[head] === w[head]) head++;
  let tail = 0;
  while (tail < max - head && t[t.length - 1 - tail] === w[w.length - 1 - tail]) tail++;
  return { head, tail, middle: typed.slice(head, typed.length - tail), gap: word.length - head - tail };
}
