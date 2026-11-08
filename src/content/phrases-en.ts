// 英語片語與口語用詞（含新世代口語）。格式：片語|中文|語氣說明。
// 美式為主；英式用法在說明標「英式」。全部適合小孩，粗俗或成人用語不收。
// 之後由 nlm 每週補充（經 Claude 審過再加進來）。

import type { Level, StudyItem } from "@/lib/types";

type Register = "phrase" | "spoken" | "slang";

const RAW: Record<number, { register: Register; text: string }[]> = {
  0: [
    { register: "phrase", text: "thank you|謝謝|任何場合都可以" },
    { register: "phrase", text: "good morning|早安|任何場合都可以" },
    { register: "spoken", text: "see you|待會見；再見|朋友、家人之間" },
  ],
  1: [
    { register: "phrase", text: "get up|起床|日常" },
    { register: "phrase", text: "look at|看著…|日常" },
    { register: "spoken", text: "no problem|沒問題；不客氣|口語，朋友之間" },
    { register: "spoken", text: "me too|我也是|口語" },
    { register: "spoken", text: "my bad|我的錯；抱歉啦|口語，朋友之間；正式場合說 I'm sorry" },
  ],
  2: [
    { register: "phrase", text: "give up|放棄|日常" },
    { register: "phrase", text: "look for|尋找|日常" },
    { register: "phrase", text: "take care of|照顧|日常" },
    { register: "spoken", text: "what's up|怎麼了；最近好嗎|口語打招呼，朋友之間" },
    { register: "spoken", text: "hang out|一起出去玩；閒晃|口語，朋友之間" },
    { register: "spoken", text: "cheers|謝啦；乾杯|英式口語常用來說謝謝" },
    { register: "slang", text: "awesome|超棒的|口語，美式很常用" },
  ],
  3: [
    { register: "phrase", text: "figure out|想出來；弄懂|日常" },
    { register: "phrase", text: "run out of|用完|日常" },
    { register: "phrase", text: "come up with|想出（點子）|日常" },
    { register: "spoken", text: "no way|不會吧；不可能|口語，表示驚訝或拒絕" },
    { register: "spoken", text: "I'm down|我可以；算我一份|口語，朋友約活動時" },
    { register: "spoken", text: "fair enough|有道理；好吧|口語，美英都常用" },
    { register: "slang", text: "lowkey|有點；偷偷地|新世代口語，只跟朋友用" },
    { register: "slang", text: "no cap|說真的，不騙你|新世代口語，只跟朋友用" },
  ],
  4: [
    { register: "phrase", text: "put up with|忍受|日常" },
    { register: "phrase", text: "look forward to|期待|日常，也可用在信件" },
    { register: "spoken", text: "it's not a big deal|沒什麼大不了|口語" },
    { register: "spoken", text: "I'm knackered|我累壞了|英式口語" },
    { register: "slang", text: "it slaps|超讚（多指音樂、食物）|新世代口語，只跟朋友用" },
    { register: "slang", text: "the vibe|氣氛；感覺|新世代口語" },
    { register: "slang", text: "that's sus|那很可疑|新世代口語，來自遊戲，只跟朋友用" },
  ],
  5: [
    { register: "phrase", text: "take something for granted|視為理所當然|日常與寫作都可用" },
    { register: "phrase", text: "in the long run|長遠來看|日常與寫作都可用" },
    { register: "spoken", text: "I'll pass|我就不用了（婉拒）|口語，有禮貌的拒絕" },
    { register: "slang", text: "main character energy|主角光環（很有自信）|新世代口語" },
    { register: "slang", text: "it's giving|很有…的感覺|新世代口語，後面接形容的東西" },
  ],
  6: [
    { register: "phrase", text: "bite the bullet|硬著頭皮做|慣用語，口語和寫作都可" },
    { register: "phrase", text: "a blessing in disguise|因禍得福|慣用語" },
    { register: "spoken", text: "I'm on the fence|我還在猶豫|口語" },
    { register: "slang", text: "touch grass|去外面走走（別一直上網）|新世代口語，半開玩笑，對長輩別用" },
  ],
};

export const REGISTER_LABEL: Record<Register, string> = {
  phrase: "片語",
  spoken: "口語",
  slang: "新世代口語",
};

export const EN_PHRASES: StudyItem[] = Object.entries(RAW).flatMap(([lvl, rows]) =>
  rows.map(({ register, text }) => {
    const [phrase, zh, note] = text.split("|");
    return {
      id: `en-phrase-${phrase.toLowerCase().replace(/[^a-z]+/g, "-")}`,
      language: "en" as const,
      skill: "vocab" as const,
      level: Number(lvl) as Level,
      prompt: phrase,
      answer: zh,
      register,
      usage: note,
    };
  }),
);
