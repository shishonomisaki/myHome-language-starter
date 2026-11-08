// 伺服器端專用：呼叫 Gemini 幫跟讀評分。金鑰由呼叫端從 Vault 取得後傳進來，這裡不保存。

import type { FocusArea, Language } from "./types";
import { labelAmbiguousPairs } from "./games";

/**
 * 依序嘗試的模型。2.5 版自 2026-09 起只開放給之前用過的專案（新金鑰會回 404），所以用 3.x；
 * 回 404（模型不存在或沒開放）或一直忙線（5xx）就換下一個。
 */
export const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash-lite"] as const;

/** 整次 AI 呼叫的上限；API 路由的 maxDuration 是 60 秒，要留時間記用量和回覆。 */
export const GEMINI_DEADLINE_MS = 50_000;
/** 主要模型最多等這麼久，太慢就改用備用模型。 */
export const PRIMARY_TIMEOUT_MS = 25_000;

/** 一個唸不準的地方。 */
export interface SpeechIssue {
  /** 哪個字（或假名）。 */
  word: string;
  /** 問題種類：長短音、重音、子音、漏字、多字… */
  kind: (typeof ISSUE_KINDS)[number];
  /** 一句中文說明怎麼唸才對。 */
  fix: string;
  /** 最小對比練習：一組只差這個音的字，例如 ["ship", "sheep"]、["おばさん", "おばあさん"]。 */
  pair: string[];
}

export interface SpeechFeedback {
  /** Gemini 聽到的內容。 */
  heard: string;
  /** 0–1，咬字嚴格評分；含混就不給高分。 */
  score: number;
  /** 給學習者的一兩句中文建議。 */
  tip: string;
  issues: SpeechIssue[];
}

/** 過關門檻：嚴格，含混不給過。 */
export const PASS_SCORE = 0.85;

/**
 * 每個模型都回 429 時丟這個，呼叫端改用瀏覽器評分。
 * daily = 每日額度用完（今天其餘時間不再試）；否則只是每分鐘次數太多，等一下就好。
 */
export class QuotaError extends Error {
  constructor(
    message: string,
    readonly daily: boolean,
  ) {
    super(message);
  }
}

/** 429 的內容裡會寫是哪一種額度（例如 GenerateRequestsPerDayPerProjectPerModel）。 */
export function isDailyQuota(body: string): boolean {
  return /PerDay/i.test(body);
}

const ISSUE_KINDS = ["vowel_length", "vowel_quality", "stress", "consonant", "mora", "missing", "extra", "other"] as const;

const LANG_NAME: Record<Language, string> = { en: "English", ja: "Japanese", es: "Spanish" };

const LANGUAGE_RULES: Record<Language, string[]> = {
  en: [
    "Check vowel length and quality strictly: short vs long pairs such as ship/sheep, full/fool, cot/coat, bit/beat, pull/pool.",
    "Check letters o, u, i and y carefully, including y used as a vowel (my, happy, gym) and silent-e words (hop/hope, cut/cute).",
    "Check word stress (REcord vs reCORD, PHOtograph vs phoTOgraphy) and sentence stress on content words.",
    "Check final consonants and consonant clusters that are often dropped (-s, -ed, -t, th, v/b, l/r).",
  ],
  ja: [
    "Check long vowels strictly (おばさん/おばあさん, ここ/こうこう, え/ええ) and count morae.",
    "Check small っ (きて/きって) and ん as its own mora.",
    "Check pitch accent where it changes meaning (はし 箸/橋) and vowel devoicing is natural, not dropped syllables.",
  ],
  es: [
    "Judge against standard Latin American Spanish, but accept Peninsular pronunciation (distinción of z/ce/ci as th, vosotros forms) as correct.",
    "Check the five pure vowels strictly: no English-style diphthongs or reduced schwa (e.g. 'no' must not sound like 'now').",
    "Check single tap r vs trilled rr (pero/perro, caro/carro) and ñ vs n (año/ano).",
    "Check word stress, especially where a written accent changes it or the meaning (papa/papá, hablo/habló, esta/está).",
    "h is silent; j and ge/gi are a throat h; b and v sound the same; ll and y sound alike; que/qui and gue/gui have a silent u.",
  ],
};

export function speechPrompt(target: string, language: Language): string {
  return [
    `A family member is practising ${LANG_NAME[language]} by reading a sentence aloud (shadowing).`,
    `Target sentence: "${target}"`,
    "You are a strict pronunciation coach. Do not give the benefit of the doubt: if a sound is mumbled, blurred, or ambiguous, count it as wrong.",
    ...LANGUAGE_RULES[language],
    "Reply in JSON with:",
    '- "heard": what you actually heard, written in the target language, keeping wrong sounds as heard;',
    '- "score": 0 to 1. Above 0.85 only if every word is clearly and correctly pronounced with right length and stress; any mumbled word keeps it below 0.85;',
    '- "issues": every problem found (at most 5, most important first), each with "word", "kind" (one of vowel_length, vowel_quality, stress, consonant, mora, missing, extra, other), "fix" (one short sentence in Traditional Chinese saying exactly how to say it, in terms of mouth shape, lip rounding, tongue position or length rather than abstract phonetics, so a learner who cannot hear the difference can still copy it), and "pair" (a minimal pair of 2 to 4 words in the target language that differ only in that sound, for practice);',
    '- "tip": one or two short, encouraging sentences in Traditional Chinese (zh-TW), suitable for a child, naming the single most useful fix.',
  ].join("\n");
}

const ISSUE_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      word: { type: "STRING" },
      kind: { type: "STRING", enum: [...ISSUE_KINDS] },
      fix: { type: "STRING" },
      pair: { type: "ARRAY", items: { type: "STRING" } },
    },
    required: ["word", "kind", "fix", "pair"],
  },
};

type Audio = { base64: string; mimeType: string };
/** 一張照片（課本或作業頁）。 */
export type Image = { base64: string; mimeType: string };

/** 一次 AI 呼叫：用哪把金鑰，以及最後是哪個模型回的（給後台看有沒有正常換模型）。 */
export interface GeminiCall {
  apiKey: string;
  model?: string;
  /** 被跳過的模型和原因（不含金鑰），給後台看為什麼沒用主要模型。 */
  skipped?: ModelSkip[];
}

export interface ModelSkip {
  model: string;
  status: number;
  reason: string;
}

/** 從 Gemini 的錯誤內容挑出看得懂的原因：額度種類（quotaId）或錯誤訊息開頭。 */
export function skipReason(body: string): string {
  const quota = /"quotaId":\s*"([^"]+)"/.exec(body)?.[1];
  if (quota) return quota.slice(0, 120);
  const message = /"message":\s*"([^"]+)"/.exec(body)?.[1];
  return (message ?? body).slice(0, 120);
}

/** 送一段錄音（和照片）加指示給 Gemini，要它照 schema 回 JSON 字串。 */
export async function generate(call: GeminiCall, prompt: string, audio: Audio | null, schema: object, image?: Image): Promise<unknown> {
  const parts: object[] = [{ text: prompt }];
  if (audio) parts.push({ inline_data: { mime_type: audio.mimeType, data: audio.base64 } });
  if (image) parts.push({ inline_data: { mime_type: image.mimeType, data: image.base64 } });
  // 思考調低：長句的逐字分析讓模型想太久，常常超過 25 秒被跳過。模型不支援這個設定時，拿掉再送一次。
  let body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { responseMimeType: "application/json", responseSchema: schema, thinkingConfig: { thinkingLevel: "low" } },
  });
  const plainBody = JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json", responseSchema: schema } });
  // 主要模型忙線（5xx）、逾時、找不到（404）或額度用完（429）就直接換下一個，不在它身上多等；
  // 最後一個模型忙線時才等一下重試一次。各模型的免費額度分開算，所以 3.8 不行還可以用 3.5 Flash-Lite。
  // 全部要在 GEMINI_DEADLINE_MS 內結束，伺服器才來得及回覆，不會被平台中斷成「AI 沒回應」。
  const deadline = Date.now() + GEMINI_DEADLINE_MS;
  let res: Response | null = null;
  const limited: string[] = [];
  // 回應內容只能讀一次，讀過的先留著，最後組錯誤訊息時還要用。
  const texts = new Map<Response, string>();
  const read = async (r: Response) => texts.get(r) ?? texts.set(r, await r.text()).get(r)!;
  const skip = async (model: string, r: Response) => {
    const text = await read(r);
    (call.skipped ??= []).push({ model, status: r.status, reason: skipReason(text) });
    return text;
  };
  outer: for (const [i, model] of GEMINI_MODELS.entries()) {
    const last = i === GEMINI_MODELS.length - 1;
    call.model = model;
    for (let attempt = 0; attempt < (last ? 2 : 1); attempt++) {
      const left = deadline - Date.now();
      const wait = last ? left : Math.min(PRIMARY_TIMEOUT_MS, left);
      if (wait <= 0) break outer;
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": call.apiKey },
          body,
          signal: AbortSignal.timeout(wait),
        });
      } catch (e) {
        if (!(e instanceof Error) || (e.name !== "TimeoutError" && e.name !== "AbortError")) throw e;
        (call.skipped ??= []).push({ model, status: 408, reason: `超過 ${Math.round(wait / 1000)} 秒沒回應` });
        res = null;
        continue outer;
      }
      if (res.status === 400 && body !== plainBody && /thinking/i.test(await read(res))) {
        body = plainBody;
        attempt--;
        continue;
      }
      if (res.status === 404) {
        await skip(model, res);
        continue outer;
      }
      if (res.status === 429) {
        limited.push(await skip(model, res));
        continue outer;
      }
      if (res.status < 500) break outer;
      if (!last) {
        await skip(model, res);
        continue outer;
      }
      if (attempt === 0) await new Promise((ok) => setTimeout(ok, 800));
    }
  }
  if (!res) throw new Error("Gemini 逾時沒有回應");
  // 有模型額度用完、其他模型也沒成功：算額度問題，讓畫面說清楚。
  if (!res.ok && limited.length) {
    const daily = limited.length > 0 && limited.every(isDailyQuota);
    throw new QuotaError(daily ? "今日 Gemini 額度用完" : "Gemini 每分鐘次數已滿", daily);
  }
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await read(res)).slice(0, 300)}`);
  const json = await res.json();
  // 會思考的模型可能先回「思考」段落，要拿真正的答案那一段。
  const answer: { text?: string; thought?: boolean }[] = json?.candidates?.[0]?.content?.parts ?? [];
  return answer.find((p) => p.text && !p.thought)?.text;
}

export async function scoreSpeech(call: GeminiCall, audio: Audio, target: string, language: Language): Promise<SpeechFeedback> {
  const text = await generate(call, speechPrompt(target, language), audio, {
    type: "OBJECT",
    properties: { heard: { type: "STRING" }, score: { type: "NUMBER" }, tip: { type: "STRING" }, issues: ISSUE_SCHEMA },
    required: ["heard", "score", "tip", "issues"],
  });
  return parseFeedback(text);
}

/** 孩子錄的學校／安親班作業，整理成隔天的練習材料。 */
export interface HomeworkContent {
  transcript: string;
  words: { word: string; meaning: string }[];
  phrases: { phrase: string; meaning: string }[];
  grammar: { point: string; example: string }[];
  /** 拿來跟讀的短句（取自錄音內容）。 */
  sentences: string[];
  issues: SpeechIssue[];
  /** 從課程往學習者原本的目標程度延伸的教材（沒有就是舊資料）。 */
  extension?: HomeworkExtension;
}

export interface HomeworkExtension {
  /** 跟課程主題相關、比課本再深一點的字。 */
  words: { word: string; meaning: string }[];
  /** 用課程主題寫、程度對準學習者目標的短文。 */
  title: string;
  text: string;
  questions: { q: string; choices: string[]; answer: number }[];
}

export function homeworkPrompt(withPhoto = false, targetLevel = ""): string {
  return [
    "A Taiwanese elementary-school child recorded themselves reading today's English class material (school or cram school) aloud, possibly with lesson audio in the background.",
    "Only the child's own voice matters. Work out what the lesson covered and prepare tomorrow's short review.",
    ...(withPhoto
      ? ["A photo of today's textbook or homework page is attached. Use it as the main source for words, phrases and grammar, and the recording for pronunciation."]
      : []),
    "Reply in JSON with:",
    '- "transcript": the English the child read, cleaned up into correct text;',
    '- "words": up to 10 key words from the lesson, each with "word" and "meaning" (short Traditional Chinese);',
    '- "phrases": up to 5 useful phrases from the lesson, each with "phrase" and "meaning" (Traditional Chinese);',
    '- "grammar": up to 3 grammar points, each with "point" (one short sentence in Traditional Chinese, suitable for a child) and "example" (an English sentence from or like the lesson);',
    '- "sentences": 3 to 5 short sentences from the lesson for the child to practise reading aloud;',
    '- "issues": pronunciation problems in the child\'s reading (at most 5), judged strictly as a pronunciation coach: vowel length (ship/sheep, o/u/i/y), stress, dropped final consonants; each with "word", "kind" (one of vowel_length, vowel_quality, stress, consonant, mora, missing, extra, other), "fix" (one short Traditional Chinese sentence) and "pair" (a minimal pair of 2 to 4 English words).',
    `- "extension": material that grows from today's lesson topic toward the learner's own target level${targetLevel ? ` (${targetLevel})` : ""}, so class content leads into deeper and broader English:`,
    '  "words": 5 related words one step beyond the lesson, each with "word" and "meaning" (Traditional Chinese);',
    '  "title" and "text": a short English reading (60 to 150 words) on the lesson topic at the target level, reusing lesson words and the new words;',
    '  "questions": 3 comprehension questions in Traditional Chinese, each with 3 "choices" in Traditional Chinese and "answer" (0-based index).',
    "If the recording has no usable English, return empty lists, an empty transcript and an empty extension text.",
  ].join("\n");
}

export async function analyzeHomework(call: GeminiCall, audio: Audio, image?: Image, targetLevel = ""): Promise<HomeworkContent> {
  const pair = (a: string, b: string) => ({
    type: "ARRAY",
    items: { type: "OBJECT", properties: { [a]: { type: "STRING" }, [b]: { type: "STRING" } }, required: [a, b] },
  });
  const text = await generate(call, homeworkPrompt(Boolean(image), targetLevel), audio, {
    type: "OBJECT",
    properties: {
      transcript: { type: "STRING" },
      words: pair("word", "meaning"),
      phrases: pair("phrase", "meaning"),
      grammar: pair("point", "example"),
      sentences: { type: "ARRAY", items: { type: "STRING" } },
      issues: ISSUE_SCHEMA,
      extension: {
        type: "OBJECT",
        properties: {
          words: pair("word", "meaning"),
          title: { type: "STRING" },
          text: { type: "STRING" },
          questions: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { q: { type: "STRING" }, choices: { type: "ARRAY", items: { type: "STRING" } }, answer: { type: "INTEGER" } },
              required: ["q", "choices", "answer"],
            },
          },
        },
        required: ["words", "title", "text", "questions"],
      },
    },
    required: ["transcript", "words", "phrases", "grammar", "sentences", "issues", "extension"],
  }, image);
  return parseHomework(text);
}

function parseIssues(list: unknown): SpeechIssue[] {
  return (Array.isArray(list) ? list : []).slice(0, 5).map((i: Record<string, unknown>) => ({
    word: String(i.word ?? ""),
    kind: (ISSUE_KINDS as readonly string[]).includes(String(i.kind)) ? (i.kind as SpeechIssue["kind"]) : "other",
    fix: String(i.fix ?? ""),
    pair: (Array.isArray(i.pair) ? i.pair : []).map(String).slice(0, 4),
  }));
}

export function parseHomework(text: unknown): HomeworkContent {
  const raw = JSON.parse(String(text ?? ""));
  const list = (v: unknown, n: number) => (Array.isArray(v) ? v : []).slice(0, n) as Record<string, unknown>[];
  return {
    transcript: String(raw.transcript ?? ""),
    words: list(raw.words, 10).map((w) => ({ word: String(w.word ?? ""), meaning: String(w.meaning ?? "") })).filter((w) => w.word),
    phrases: list(raw.phrases, 5).map((p) => ({ phrase: String(p.phrase ?? ""), meaning: String(p.meaning ?? "") })).filter((p) => p.phrase),
    grammar: list(raw.grammar, 3).map((g) => ({ point: String(g.point ?? ""), example: String(g.example ?? "") })).filter((g) => g.point),
    sentences: (Array.isArray(raw.sentences) ? raw.sentences : []).map(String).filter(Boolean).slice(0, 5),
    issues: parseIssues(raw.issues),
    extension: parseExtension(raw.extension),
  };
}

export function parseFeedback(text: unknown): SpeechFeedback {
  const raw = JSON.parse(String(text ?? ""));
  const score = Number(raw.score);
  if (!Number.isFinite(score)) throw new Error("Gemini 回傳格式不對");
  const issues = parseIssues(raw.issues);
  // 嚴格：只要有問題就不能過關。
  const capped = issues.length ? Math.min(score, PASS_SCORE - 0.01) : score;
  return { heard: String(raw.heard ?? ""), score: Math.min(1, Math.max(0, capped)), tip: String(raw.tip ?? ""), issues };
}

function parseExtension(raw: unknown): HomeworkExtension | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const e = raw as Record<string, unknown>;
  const text = String(e.text ?? "").trim();
  if (!text) return undefined;
  const words = (Array.isArray(e.words) ? e.words : [])
    .slice(0, 5)
    .map((w: Record<string, unknown>) => ({ word: String(w.word ?? ""), meaning: String(w.meaning ?? "") }))
    .filter((w) => w.word);
  const questions = (Array.isArray(e.questions) ? e.questions : [])
    .slice(0, 3)
    .map((q: Record<string, unknown>) => ({
      q: String(q.q ?? ""),
      choices: (Array.isArray(q.choices) ? q.choices : []).map(String).slice(0, 4),
      answer: Number(q.answer),
    }))
    .filter((q) => q.q && q.choices.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length);
  return { words, title: String(e.title ?? ""), text, questions };
}

/** 管理者指定的強化單元：先講重點、再練習、最後小測，約 10 分鐘。 */
export interface FocusQuestion {
  q: string;
  choices: string[];
  answer: number;
  /** 答完後顯示的一句說明（繁體中文）。 */
  explain: string;
  /** 聽力題：要唸給學習者聽的內容（題庫題目每題各自一段）。 */
  audio?: string;
}

export interface FocusDrill {
  title: string;
  /** 重點說明（繁體中文，短）。 */
  explain: string;
  /** 例句或聽力短文（學習的語言）。 */
  passage: string;
  practice: FocusQuestion[];
  test: FocusQuestion[];
  /** 拼句、聽寫用的短句（學習的語言）。 */
  sentences: string[];
  /** 配對、字母重組用的詞與中文意思。 */
  /** pos：詞性（名／動／形…）；example：用到這個字的短例句（易混字教學卡用）。舊資料沒有這兩欄。 */
  pairs: { term: string; meaning: string; pos?: string; example?: string }[];
  /** 舊作業變化練習：這份題目練的項目（決定小遊戲）。 */
  area?: FocusArea;
}

const FOCUS_TOPIC: Record<FocusArea, string> = {
  vocab: "vocabulary: useful words at this level, meaning and usage in context, confusable words",
  grammar: "grammar: one or two grammar points at this level, with common mistakes Taiwanese learners make",
  pattern: "sentence patterns: everyday spoken sentence patterns at this level and how to build sentences with them",
  pronunciation:
    "pronunciation awareness: vowel length, stress and sounds Taiwanese learners confuse (e.g. o/u/i/y in English, long vowels and small tsu in Japanese); questions about which word has which sound or stress",
  listening: "listening: a short everyday passage the learner will hear read aloud, with comprehension questions",
};

export function focusPrompt(area: FocusArea, language: Language, level: string, recentMistakes: string[] = [], weakWords: string[] = [], homework: string[] = []): string {
  const lang = LANG_NAME[language];
  return [
    `Make a 10-minute ${lang} practice unit for a Taiwanese learner at level ${level || "beginner"}.`,
    `Focus area: ${FOCUS_TOPIC[area]}.`,
    ...(homework.length
      ? [
          "This is a review day built from the child's own past school English lessons (no new class today). Lesson material, oldest first:",
          ...homework.map((h) => `- ${h}`),
          "Reuse these words, phrases and grammar, but do NOT copy the textbook sentences: put them in new everyday situations (home, school, games, animals, sports, food), mix words from different lessons together, ask the child to apply them (choose the right word for a new situation, change the sentence to a question or negative, swap the subject, etc.).",
          "Stay at the learner's level: if the lesson is easier, stretch it a little toward the level; if harder, keep it simple. The title should mention it is a review of past lessons.",
        ]
      : []),
    ...(weakWords.length
      ? [
          `The learner's AI speaking coach has flagged these words again and again while reading aloud (word (problem: how to fix; minimal pair)): ${weakWords.join("; ")}.`,
          "If a HABIT line is given, start the explanation with that error type in general, then each word. Make every sentence in \"sentences\" contain at least one flagged word. Build the whole unit around these words and their sounds: explain how to say each one, use them and their minimal pairs in the questions, and put them in the sentences so the learner can read them aloud.",
        ]
      : []),
    ...(recentMistakes.length ? [`Recently missed items to review: ${recentMistakes.slice(0, 10).join("; ")}.`] : []),
    "Reply in JSON with:",
    '- "title": a short Traditional Chinese title;',
    '- "explain": the key points in at most 5 short Traditional Chinese sentences, with target-language examples;',
    `- "passage": ${area === "listening" ? `a ${lang} passage of 60 to 120 words at this level (it will be read aloud by TTS)` : `3 to 5 example ${lang} sentences, one per line`};`,
    '- "practice": 6 multiple-choice questions that teach and review the points, each with "q", "choices" (3 or 4), "answer" (0-based index) and "explain" (one short Traditional Chinese sentence);',
    '- "test": 5 new multiple-choice questions checking the same points, same fields;',
    `- "sentences": 3 short ${lang} sentences (4 to 9 words) using the points, for sentence-building and dictation games${language === "ja" ? " (put a half-width space between each bunsetsu chunk, e.g. 私は 学生 です。)" : ""};`,
    `- "pairs": 5 ${lang} words or phrases from the unit, each with "term", "pos" (part of speech in Chinese: 名/動/形/副/片語), "example" (one short sentence using the exact term) and "meaning" (short Traditional Chinese, ending with the part of speech in full-width brackets, e.g. \"影響（動詞）\" / \"影響（名詞）\"), for matching and spelling games. Every meaning in the set must be clearly different: if two words share a Chinese meaning (effect/affect, advice/advise), add the part of speech and a short hint so a child can tell which is which. Confusable pairs are welcome (they are worth learning) but must be explained in "explain" with one example each.`,
    area === "listening" ? "All questions must be answerable only by listening to the passage." : "",
    "Keep wording simple enough for a child when the level is beginner.",
  ]
    .filter(Boolean)
    .join("\n");
}

const QUESTION_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      q: { type: "STRING" },
      choices: { type: "ARRAY", items: { type: "STRING" } },
      answer: { type: "INTEGER" },
      explain: { type: "STRING" },
    },
    required: ["q", "choices", "answer", "explain"],
  },
};

export async function makeFocusDrill(
  call: GeminiCall,
  area: FocusArea,
  language: Language,
  level: string,
  recentMistakes: string[] = [],
  weakWords: string[] = [],
  homework: string[] = [],
): Promise<FocusDrill> {
  const text = await generate(call, focusPrompt(area, language, level, recentMistakes, weakWords, homework), null, {
    type: "OBJECT",
    properties: {
      title: { type: "STRING" },
      explain: { type: "STRING" },
      passage: { type: "STRING" },
      practice: QUESTION_SCHEMA,
      test: QUESTION_SCHEMA,
      sentences: { type: "ARRAY", items: { type: "STRING" } },
      pairs: {
        type: "ARRAY",
        items: { type: "OBJECT", properties: { term: { type: "STRING" }, meaning: { type: "STRING" }, pos: { type: "STRING" }, example: { type: "STRING" } }, required: ["term", "meaning"] },
      },
    },
    required: ["title", "explain", "passage", "practice", "test", "sentences", "pairs"],
  });
  return parseFocus(text);
}

function parseQuestions(raw: unknown, max: number): FocusQuestion[] {
  return (Array.isArray(raw) ? raw : [])
    .slice(0, max)
    .map((q: Record<string, unknown>) => ({
      q: String(q.q ?? ""),
      choices: (Array.isArray(q.choices) ? q.choices : []).map(String).slice(0, 4),
      answer: Number(q.answer),
      explain: String(q.explain ?? ""),
    }))
    .filter((q) => q.q && q.choices.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length);
}

export function parseFocus(text: unknown): FocusDrill {
  const raw = JSON.parse(String(text ?? ""));
  const drill = {
    title: String(raw.title ?? ""),
    explain: String(raw.explain ?? ""),
    passage: String(raw.passage ?? ""),
    practice: parseQuestions(raw.practice, 8),
    test: parseQuestions(raw.test, 6),
    sentences: (Array.isArray(raw.sentences) ? raw.sentences : []).map(String).map((x: string) => x.trim()).filter(Boolean).slice(0, 3),
    pairs: (Array.isArray(raw.pairs) ? raw.pairs : [])
      .map((p: Record<string, unknown>) => ({
        term: String(p.term ?? "").trim(),
        meaning: String(p.meaning ?? "").trim(),
        ...(p.pos ? { pos: String(p.pos).trim() } : {}),
        ...(p.example ? { example: String(p.example).trim() } : {}),
      }))
      .filter((p: { term: string; meaning: string }) => p.term && p.meaning)
      .slice(0, 6),
  };
  drill.pairs = labelAmbiguousPairs(drill.pairs);
  if (!drill.test.length) throw new Error("Gemini 回傳格式不對");
  return drill;
}
