// 五十音（清音 46 個）。羅馬拼音只在五十音單元當讀音答案用，之後的日語練習一律不顯示。

import type { StudyItem } from "@/lib/types";

const ROWS: [string, string, string][] = [
  // [平假名, 片假名, 讀音]
  ["あ", "ア", "a"], ["い", "イ", "i"], ["う", "ウ", "u"], ["え", "エ", "e"], ["お", "オ", "o"],
  ["か", "カ", "ka"], ["き", "キ", "ki"], ["く", "ク", "ku"], ["け", "ケ", "ke"], ["こ", "コ", "ko"],
  ["さ", "サ", "sa"], ["し", "シ", "shi"], ["す", "ス", "su"], ["せ", "セ", "se"], ["そ", "ソ", "so"],
  ["た", "タ", "ta"], ["ち", "チ", "chi"], ["つ", "ツ", "tsu"], ["て", "テ", "te"], ["と", "ト", "to"],
  ["な", "ナ", "na"], ["に", "ニ", "ni"], ["ぬ", "ヌ", "nu"], ["ね", "ネ", "ne"], ["の", "ノ", "no"],
  ["は", "ハ", "ha"], ["ひ", "ヒ", "hi"], ["ふ", "フ", "fu"], ["へ", "ヘ", "he"], ["ほ", "ホ", "ho"],
  ["ま", "マ", "ma"], ["み", "ミ", "mi"], ["む", "ム", "mu"], ["め", "メ", "me"], ["も", "モ", "mo"],
  ["や", "ヤ", "ya"], ["ゆ", "ユ", "yu"], ["よ", "ヨ", "yo"],
  ["ら", "ラ", "ra"], ["り", "リ", "ri"], ["る", "ル", "ru"], ["れ", "レ", "re"], ["ろ", "ロ", "ro"],
  ["わ", "ワ", "wa"], ["を", "ヲ", "wo"], ["ん", "ン", "n"],
];

/** 長得像、容易混淆的字，練習時會互相當干擾選項。 */
export const LOOKALIKE_GROUPS: string[][] = [
  ["さ", "ち", "き"],
  ["ぬ", "め", "ね", "れ", "わ"],
  ["る", "ろ"],
  ["は", "ほ", "け"],
  ["い", "り"],
  ["シ", "ツ", "ン", "ソ"],
  ["ク", "ケ", "タ"],
  ["ウ", "ワ", "フ"],
  ["コ", "ユ", "ロ"],
  ["ア", "マ"],
];

/** 圖像聯想提示（先放常混淆的字，其餘由家長在後台補）。 */
const MNEMONICS: Record<string, string> = {
  さ: "像一個人彎腰「撒」種子，下面的勾往左開",
  ち: "跟さ相反，勾往右開，像數字 5 的「七」",
  き: "像一把鑰匙（key），比さ多一橫",
  ぬ: "像一碗麵條，尾巴打一個結",
  め: "像一隻眼睛（目 me），沒有結",
  ね: "像一隻貓（neko）捲著尾巴",
  れ: "右邊像人往外踢腳",
  わ: "右邊圓圓收回來，像在說「哇」",
  る: "底下有圈，像繞（ru）一圈",
  ろ: "底下沒有圈，像路（ro）直直的",
  シ: "兩點橫排，最後一筆由下往上撇，像在微笑",
  ツ: "兩點直排，最後一筆由上往下，像海嘯（tsunami）",
  ン: "只有一點，最後一筆由下往上",
  ソ: "一點一撇，都由上往下",
};

function groupOf(ch: string): string | undefined {
  const i = LOOKALIKE_GROUPS.findIndex((g) => g.includes(ch));
  return i >= 0 ? `look-${i}` : undefined;
}

function toItems(script: "hira" | "kata"): StudyItem[] {
  return ROWS.map(([h, k, roma], i) => {
    const ch = script === "hira" ? h : k;
    return {
      id: `ja-kana-${script}-${roma}`,
      language: "ja",
      skill: "reading",
      level: 0,
      prompt: ch,
      answer: roma,
      speak: h,
      extra: MNEMONICS[ch],
      group: groupOf(ch) ?? `${script}-${Math.floor(i / 5)}`,
    };
  });
}

export const HIRAGANA: StudyItem[] = toItems("hira");
export const KATAKANA: StudyItem[] = toItems("kata");
/** 學習順序：平假名先、片假名後，一次 5 個新字。 */
export const KANA_ITEMS: StudyItem[] = [...HIRAGANA, ...KATAKANA];
export const KANA_NEW_PER_DAY = 5;

/** 學完馬上用：用學過的假名拼的真的字。 */
export const KANA_REAL_WORDS: { word: string; meaning: string }[] = [
  { word: "あい", meaning: "愛" },
  { word: "いえ", meaning: "家" },
  { word: "うえ", meaning: "上面" },
  { word: "かお", meaning: "臉" },
  { word: "すし", meaning: "壽司" },
  { word: "ねこ", meaning: "貓" },
  { word: "いぬ", meaning: "狗" },
  { word: "さかな", meaning: "魚" },
  { word: "ありがとう", meaning: "謝謝" },
  { word: "コーヒー", meaning: "咖啡" },
  { word: "テレビ", meaning: "電視" },
  { word: "アニメ", meaning: "動畫" },
  { word: "ラーメン", meaning: "拉麵" },
  { word: "ゲーム", meaning: "遊戲" },
];
