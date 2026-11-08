// 作文練習：題目、英檢式評分換算、Gemini 回覆解析。瀏覽器和伺服器都能用（不碰金鑰）。

import type { Level } from "./types";

/** 英檢寫作四個面向，各 0–5 級。 */
export const ESSAY_DIMENSIONS = [
  { key: "content", name: "內容切題" },
  { key: "organization", name: "組織連貫" },
  { key: "grammar", name: "文法正確" },
  { key: "vocabulary", name: "用字拼字" },
] as const;
export type EssayDimension = (typeof ESSAY_DIMENSIONS)[number]["key"];

/** 兩次評分差超過這個就請 Claude 複評。 */
export const REGRADE_GAP = 10;
/** 升級考寫作門檻（之後第三階段用）。 */
export const ESSAY_PASS = 80;

export interface EssayEdit {
  /** 原句（照寫的人原本的寫法）。 */
  original: string;
  /** 改好的句子。 */
  corrected: string;
  /** 為什麼這樣改，一句繁體中文。 */
  why: string;
}

export interface EssayFeedback {
  /** 照片辨識出的文字，或原本打的文字。 */
  text: string;
  /** 各面向 0–5。 */
  bands: Record<EssayDimension, number>;
  /** 各面向一句說明。 */
  notes: Record<EssayDimension, string>;
  /** 換算後 0–100。 */
  score: number;
  /** 第二次評分（只算分數），用來檢查公正性。 */
  checkScore?: number;
  /** 兩次差太多，等 Claude 複評。 */
  needsReview?: boolean;
  edits: EssayEdit[];
  /** 整體講評。 */
  comment: string;
  /** 改進建議（要練的弱點），最多 3 個。 */
  tips: string[];
  /** 改寫範例（保留原意、符合目標級數）。 */
  rewrite: string;
}

export interface EssayPrompt {
  id: string;
  title: string;
  /** 給寫的人看的中文說明。 */
  hint: string;
  /** 小孩：幾句；大人：大約字數。 */
  target: string;
}

/** 依程度出的題目：小孩一週一段約五句；大人自由選。 */
export function essayPrompts(level: Level, adult: boolean): EssayPrompt[] {
  if (!adult && level <= 2) {
    return [
      { id: "my-day", title: "My Weekend", hint: "寫你週末做了什麼，用過去式（went、played、ate）。", target: "約 5 句" },
      { id: "pet", title: "An Animal I Like", hint: "介紹一種你喜歡的動物（像鴨嘴獸！）：長什麼樣子、住哪裡、為什麼喜歡。", target: "約 5 句" },
      { id: "game", title: "My Favorite Game", hint: "介紹一個你喜歡的遊戲（薩爾達、Pikmin…）：怎麼玩、你最喜歡哪裡。", target: "約 5 句" },
      { id: "hero", title: "My Favorite Character", hint: "介紹一個你喜歡的卡通或動漫角色，他會做什麼？", target: "約 5 句" },
      { id: "sport", title: "A Sport I Play", hint: "寫一個你做過的運動（跑步、足球…），感覺怎麼樣？", target: "約 5 句" },
      { id: "free", title: "", hint: "自己想一個題目，寫在上面標題欄。", target: "約 5 句" },
    ];
  }
  if (!adult) {
    return [
      { id: "adventure", title: "A Day in a Fantasy World", hint: "想像你走進一個奇幻世界（海拉魯、希臘神話…），寫發生了什麼事。", target: "6–8 句" },
      { id: "science", title: "A Cool Science Fact", hint: "介紹一個你覺得很酷的自然科學知識，並說明為什麼。", target: "6–8 句" },
      { id: "maker", title: "Something I Made", hint: "寫一個你做過的作品（小小創客），怎麼做的、遇到什麼困難。", target: "6–8 句" },
      { id: "book", title: "A Book I Enjoyed", hint: "介紹一本你喜歡的書（波西傑克森、柯南…），故事在說什麼、你的感想。", target: "6–8 句" },
      { id: "free", title: "", hint: "自己想一個題目，寫在上面標題欄。", target: "6–8 句" },
    ];
  }
  const words = level <= 3 ? "約 120 字（英檢中級）" : level <= 4 ? "150–180 字（英檢中高級）" : "約 250 字（英檢高級）";
  return [
    { id: "screen", title: "Should Children Have Limited Screen Time?", hint: "表明立場，給兩個理由和例子。", target: words },
    { id: "travel", title: "A Trip That Changed My View", hint: "描述一趟旅行，以及它怎麼改變你的想法。", target: words },
    { id: "work", title: "Working From Home: Pros and Cons", hint: "比較在家工作的好處與壞處，最後給你的結論。", target: words },
    { id: "ai", title: "How AI Is Changing Language Learning", hint: "舉出改變、好處和要注意的地方。", target: words },
    { id: "chart", title: "Describe a Trend", hint: "選一個你熟悉的趨勢（例如台灣的外送、電動車），描述變化並解釋原因（中高級看圖表題的練習）。", target: words },
    { id: "free", title: "", hint: "自由題：自己訂題目，寫你想寫的。", target: words },
  ];
}

/** 四個 0–5 換算成 100 分（四捨五入）。 */
export function bandsToScore(bands: Record<EssayDimension, number>): number {
  const sum = ESSAY_DIMENSIONS.reduce((s, d) => s + clampBand(bands[d.key]), 0);
  return Math.round((sum / 20) * 100);
}

function clampBand(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(5, Math.max(0, Math.round(n))) : 0;
}

/** 兩次分數差太多就需要複評。 */
export function needsRegrade(a: number, b: number): boolean {
  return Math.abs(a - b) > REGRADE_GAP;
}

export function parseEssayFeedback(text: unknown): EssayFeedback {
  const raw = JSON.parse(String(text ?? ""));
  const bands = {} as Record<EssayDimension, number>;
  const notes = {} as Record<EssayDimension, string>;
  for (const d of ESSAY_DIMENSIONS) {
    const v = raw?.[d.key] ?? {};
    bands[d.key] = clampBand(v.band);
    notes[d.key] = String(v.note ?? "");
  }
  const list = (v: unknown) => (Array.isArray(v) ? v : []) as Record<string, unknown>[];
  return {
    text: String(raw.text ?? "").trim(),
    bands,
    notes,
    score: bandsToScore(bands),
    edits: list(raw.edits)
      .slice(0, 12)
      .map((e) => ({ original: String(e.original ?? ""), corrected: String(e.corrected ?? ""), why: String(e.why ?? "") }))
      .filter((e) => e.original && e.corrected && e.original !== e.corrected),
    comment: String(raw.comment ?? ""),
    tips: (Array.isArray(raw.tips) ? raw.tips : []).map(String).filter(Boolean).slice(0, 3),
    rewrite: String(raw.rewrite ?? ""),
  };
}

/** 只評分的第二次回覆。 */
export function parseCheckScore(text: unknown): number {
  const raw = JSON.parse(String(text ?? ""));
  const bands = {} as Record<EssayDimension, number>;
  for (const d of ESSAY_DIMENSIONS) bands[d.key] = clampBand(raw?.[d.key]);
  return bandsToScore(bands);
}

/** 字數（英文以空白分詞）。 */
export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}
