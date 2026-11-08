import type { Language, StudyItem } from "@/lib/types";
import { KANA_ITEMS } from "./kana";
import { EN_VOCAB } from "./vocab-en";
import { JA_VOCAB } from "./vocab-ja";
import { ES_VOCAB } from "./vocab-es";
import { EN_PHRASES } from "./phrases-en";

export { KANA_ITEMS, KANA_NEW_PER_DAY, KANA_REAL_WORDS, LOOKALIKE_GROUPS } from "./kana";
export { READINGS } from "./readings";
export { EN_PHRASES, REGISTER_LABEL } from "./phrases-en";

export const VOCAB: Record<Language, StudyItem[]> = { en: EN_VOCAB, ja: JA_VOCAB, es: ES_VOCAB };

export const ALL_ITEMS: StudyItem[] = [...KANA_ITEMS, ...EN_VOCAB, ...EN_PHRASES, ...JA_VOCAB, ...ES_VOCAB];
const BY_ID = new Map(ALL_ITEMS.map((i) => [i.id, i]));

export function itemById(id: string): StudyItem | undefined {
  return BY_ID.get(id);
}
