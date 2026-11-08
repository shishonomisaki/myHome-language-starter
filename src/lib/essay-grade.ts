// 伺服器端：請 Gemini 以資深 ESL 老師身份批改作文（英檢寫作四面向），再獨立評一次分數檢查公正性。

import { generate, type GeminiCall, type Image } from "./gemini";
import { ESSAY_DIMENSIONS, parseCheckScore, parseEssayFeedback, type EssayFeedback } from "./essay";

export interface EssayTask {
  title: string;
  /** 寫的人的目標級數，例如「L3 英檢中級」。 */
  level: string;
  /** 小孩用比較溫和、簡單的中文講評。 */
  kid: boolean;
  text: string;
  image?: Image;
}

export function essayPrompt(t: EssayTask): string {
  return [
    "You are a senior ESL teacher and GEPT (全民英檢) writing examiner in Taiwan. Grade this English writing strictly but kindly.",
    `Writer: ${t.kid ? "a Taiwanese elementary-school child" : "a Taiwanese adult learner"}; target level: ${t.level}.`,
    `Topic: ${t.title || "(free topic)"}`,
    t.image
      ? "The writing is in the attached photo of a handwritten page. First transcribe it exactly as written (keep the writer's mistakes) into \"text\"."
      : "The writing is below; copy it unchanged into \"text\".",
    "Score each GEPT writing dimension with a band 0-5 judged against the target level (5 = fully meets that level):",
    "- content: on topic, ideas complete and developed;",
    "- organization: paragraphing, logical order, linking words;",
    "- grammar: accuracy and range of sentence structures;",
    "- vocabulary: word choice and spelling appropriate to the level.",
    "Each dimension has \"band\" and \"note\" (one sentence in Traditional Chinese).",
    "\"edits\": line-by-line corrections for every sentence that has an error (at most 12): \"original\" (the writer's sentence), \"corrected\", and \"why\" (one short Traditional Chinese sentence).",
    `"comment": overall commentary in Traditional Chinese, 2-4 sentences${t.kid ? ", warm and simple enough for a child, start with something they did well" : ""}.`,
    "\"tips\": up to 3 concrete improvement suggestions in Traditional Chinese (the weaknesses to practise next).",
    "\"rewrite\": a model rewrite in English that keeps the writer's ideas and fits the target level.",
    "If there is no readable English writing, return an empty \"text\" and bands of 0.",
    ...(t.image ? [] : ["", "Writing:", t.text]),
  ].join("\n");
}

const DIM = { type: "OBJECT", properties: { band: { type: "INTEGER" }, note: { type: "STRING" } }, required: ["band", "note"] };

export async function gradeEssay(call: GeminiCall, t: EssayTask): Promise<EssayFeedback> {
  const dims = Object.fromEntries(ESSAY_DIMENSIONS.map((d) => [d.key, DIM]));
  const out = await generate(
    call,
    essayPrompt(t),
    null,
    {
      type: "OBJECT",
      properties: {
        text: { type: "STRING" },
        ...dims,
        edits: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: { original: { type: "STRING" }, corrected: { type: "STRING" }, why: { type: "STRING" } },
            required: ["original", "corrected", "why"],
          },
        },
        comment: { type: "STRING" },
        tips: { type: "ARRAY", items: { type: "STRING" } },
        rewrite: { type: "STRING" },
      },
      required: ["text", ...ESSAY_DIMENSIONS.map((d) => d.key), "edits", "comment", "tips", "rewrite"],
    },
    t.image,
  );
  return parseEssayFeedback(out);
}

/** 第二位考官：只看文字、只給四個級分（很省額度），用來檢查第一次評分。 */
export async function checkScore(call: GeminiCall, t: EssayTask, text: string): Promise<number> {
  const out = await generate(
    call,
    [
      "You are an independent GEPT writing examiner. Give only bands 0-5 for content, organization, grammar and vocabulary,",
      `judged against the target level ${t.level}, for this ${t.kid ? "child's" : "adult's"} writing on "${t.title || "a free topic"}".`,
      "",
      text,
    ].join("\n"),
    null,
    {
      type: "OBJECT",
      properties: Object.fromEntries(ESSAY_DIMENSIONS.map((d) => [d.key, { type: "INTEGER" }])),
      required: ESSAY_DIMENSIONS.map((d) => d.key),
    },
  );
  return parseCheckScore(out);
}
