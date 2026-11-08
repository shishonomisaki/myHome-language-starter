import { splitWithOffsets } from "@/lib/speech";
import type { Language } from "@/lib/types";

/** 一段文字裡可以點來唸的片段（原文字元位置）。 */
export interface Segment {
  start: number;
  text: string;
}

/** 外語的字：拉丁字母（含西語重音字母）或日文假名。 */
const FOREIGN: Record<Language, RegExp> = {
  en: /[A-Za-z]/,
  es: /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ¿¡]/,
  ja: /[぀-ヿ]/,
};

/**
 * 找出可以點的句子。
 * 整段都是外語：一句一句切。
 * 中外文夾雜（例如中文解說裡的英文例句）：只挑出外語的那幾段，中文不唸。
 */
export function speakableSegments(text: string, language: Language, mixed: boolean): Segment[] {
  if (!mixed) return splitWithOffsets(text).filter((p) => FOREIGN[language].test(p.text));
  // 外語段落：從外語字開始，一直到遇到中文字、換行或中文標點為止。
  const run =
    language === "ja"
      ? /[぀-ヿ一-鿿][぀-ヿ一-鿿、ー〜…！？。\s0-9]*/g
      : /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ¿¡0-9'"“][A-Za-zÁÉÍÓÚÜÑáéíóúüñ¿¡0-9'"“”‘’ ,.;:!?\-()]*/g;
  const out: Segment[] = [];
  for (const m of text.matchAll(run)) {
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    let t = raw.trim().replace(/[(\-,;:]+$/, "").trim();
    // 日文和中文的漢字分不出來：段落只到最後一個假名或句號為止，後面的漢字當中文。
    if (language === "ja") {
      const end = Math.max(...[...t.matchAll(/[\u3040-\u30ff。！？]/g)].map((x) => x.index! + 1), 0);
      t = t.slice(0, end);
    }
    if (!FOREIGN[language].test(t)) continue;
    // 日文段落要有假名才算（避免把純中文當日文）；英西文至少兩個字才算例句，單字留給單字卡。
    if (language === "ja" ? !/[぀-ヿ]/.test(t) : !/\S\s+\S/.test(t)) continue;
    // 拆成一句一句，長的例句段落也能單句點。
    for (const p of splitWithOffsets(t)) out.push({ start: m.index! + lead + p.start, text: p.text });
  }
  return out;
}

