// 分級短文：閱讀與聽力共用（先讀再聽，或先聽再看原文）。

import type { Language, Level } from "@/lib/types";
import { EN_READINGS_MORE } from "./readings-en-more";
import { JA_READINGS_MORE } from "./readings-ja-more";
import { CULTURE_READINGS } from "./readings-culture";
import { ES_READINGS } from "./readings-es";
import { EXTRA_QUESTIONS } from "./readings-extra-questions";

export interface Reading {
  id: string;
  language: Language;
  level: Level;
  title: string;
  text: string;
  questions: ReadingQuestion[];
  /** 主題：culture＝從台灣出發看歐美／日本的文化短文。 */
  topic?: "culture";
  /** 文化短文介紹的是哪裡的做法（例如「美國」「英國」「日本」）。 */
  region?: string;
  /** 開放式思考題（道德、價值判斷），不計分，回答會存給家長看。 */
  think?: ThinkPrompt[];
}

export interface ThinkPrompt {
  /** 中文題目（孩子可以用中文回答）。 */
  q: string;
  /** 外語版題目，3 級起顯示。 */
  qT?: string;
}

export interface ReadingQuestion {
  /** 中文題目與選項（初學者用）。 */
  q: string;
  choices: string[];
  /** 同一題的英文或日文版本，程度到了就改用這個。 */
  qT?: string;
  choicesT?: string[];
  answer: number;
}

/**
 * 理解題用什麼語言問：初學（0–1 級）用中文，先確定是「看懂短文」而不是卡在「看不懂題目」；
 * 2 級起改成外語題目、下面附中文；3 級起全部外語，練習直接用外語思考。
 */
export type QuestionMode = "zh" | "both" | "target";

export function questionMode(level: number): QuestionMode {
  if (level <= 1) return "zh";
  if (level === 2) return "both";
  return "target";
}

/** showZh：學習者點了「看中文」或答錯了，外語題目下面附上中文題目、選項後面附中文。 */
export function presentQuestion(q: ReadingQuestion, mode: QuestionMode, showZh = false): { q: string; sub?: string; choices: string[] } {
  if (mode === "zh" || !q.qT) return { q: q.q, choices: q.choices };
  const target = q.choicesT?.length === q.choices.length ? q.choicesT : q.choices;
  const choices = showZh && target !== q.choices ? target.map((c, j) => `${c}（${q.choices[j]}）`) : target;
  return mode === "both" || showZh ? { q: q.qT, sub: q.q, choices } : { q: q.qT, choices };
}

/** 看了中文才答對只算半題，自己答對算一題。 */
export function readingScore(questions: ReadingQuestion[], answers: Record<number, number>, hinted: Record<number, boolean>): number {
  return questions.reduce((sum, q, i) => sum + (answers[i] === q.answer ? (hinted[i] ? 0.5 : 1) : 0), 0);
}

/**
 * 短文出題順序：只出自己的級數上下一級；同級優先，再來低一級，最後才高一級；
 * 同樣距離時沒做過的排前面。範圍內都沒有短文時，才退回最接近的級數。
 */
export function orderReadings(list: Reading[], level: number, done: Set<string>): Reading[] {
  const key = (r: Reading) => [Math.abs(r.level - level), done.has(r.id) ? 1 : 0, r.level > level ? 1 : 0];
  const sorted = [...list].sort((a, b) => {
    const [x, y] = [key(a), key(b)];
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  });
  const near = sorted.filter((r) => Math.abs(r.level - level) <= 1);
  return near.length ? near : sorted.slice(0, 1);
}

const BASE_READINGS: Reading[] = [
  {
    id: "en-r-my-cat",
    language: "en",
    level: 0,
    title: "My Cat",
    text: "I have a cat. My cat is small. It is black and white. It likes milk. It sleeps on my bed.",
    questions: [
      {
        q: "貓是什麼顏色？",
        choices: ["黑白色", "紅色", "藍色"],
        qT: "What color is the cat?",
        choicesT: ["Black and white", "Red", "Blue"],
        answer: 0,
      },
      {
        q: "貓喜歡什麼？",
        choices: ["魚", "牛奶", "蘋果"],
        qT: "What does the cat like?",
        choicesT: ["Fish", "Milk", "Apples"],
        answer: 1,
      },
      {
        q: "貓睡在哪裡？",
        choices: ["椅子上", "書桌上", "床上"],
        qT: "Where does the cat sleep?",
        choicesT: ["On a chair", "On a desk", "On the bed"],
        answer: 2,
      },
    ],
  },
  {
    id: "en-r-sunday",
    language: "en",
    level: 1,
    title: "Sunday Morning",
    text: "On Sunday morning, Amy and her brother go to the park. They ride their bikes. Their dad walks the dog. After that, they eat breakfast at a small store. Amy has bread and milk. Her brother has rice and eggs.",
    questions: [
      {
        q: "他們星期天早上去哪裡？",
        choices: ["學校", "公園", "醫院"],
        qT: "Where do they go on Sunday morning?",
        choicesT: ["To school", "To the park", "To the hospital"],
        answer: 1,
      },
      {
        q: "爸爸在做什麼？",
        choices: ["騎腳踏車", "溜狗", "煮早餐"],
        qT: "What does Dad do?",
        choicesT: ["He rides a bike.", "He walks the dog.", "He cooks breakfast."],
        answer: 1,
      },
      {
        q: "Amy 早餐吃什麼？",
        choices: ["麵包和牛奶", "飯和蛋", "魚"],
        qT: "What does Amy have for breakfast?",
        choicesT: ["Bread and milk", "Rice and eggs", "Fish"],
        answer: 0,
      },
    ],
  },
  {
    id: "en-r-library",
    language: "en",
    level: 2,
    title: "A Visit to the Library",
    text: "Tom wants to borrow a book about animals for his science class. He goes to the library after school. The library is quiet, so he speaks softly. He finds a famous book about sea animals. He must return it in two weeks, so he decides to read ten pages every day.",
    questions: [
      {
        q: "Tom 為什麼要借書？",
        choices: ["為了自然課", "為了旅行", "為了送朋友"],
        qT: "Why does Tom want to borrow a book?",
        choicesT: ["For his science class", "For a trip", "As a gift for a friend"],
        answer: 0,
      },
      {
        q: "他借的書是關於什麼？",
        choices: ["森林動物", "海洋動物", "歷史"],
        qT: "What is the book about?",
        choicesT: ["Forest animals", "Sea animals", "History"],
        answer: 1,
      },
      {
        q: "他打算怎麼讀完？",
        choices: ["一天讀完", "每天讀十頁", "請哥哥唸給他聽"],
        qT: "How will he finish the book?",
        choicesT: ["Read it all in one day", "Read ten pages every day", "Ask his brother to read it to him"],
        answer: 1,
      },
    ],
  },
  {
    id: "en-r-new-neighbor",
    language: "en",
    level: 2,
    title: "The New Neighbor",
    text: "Last week a new family moved into the house next to ours. Their son, Ken, is in my grade, but he goes to a different school. On Saturday my mom baked cookies, and we brought them over to say hello. Ken showed me his model trains. We are going to build a track together next weekend.",
    questions: [
      {
        q: "新鄰居什麼時候搬來？",
        choices: ["昨天", "上週", "上個月"],
        qT: "When did the new family move in?",
        choicesT: ["Yesterday", "Last week", "Last month"],
        answer: 1,
      },
      {
        q: "媽媽做了什麼帶過去？",
        choices: ["蛋糕", "餅乾", "麵包"],
        qT: "What did Mom bring to the new family?",
        choicesT: ["A cake", "Cookies", "Bread"],
        answer: 1,
      },
      {
        q: "他們下週末打算做什麼？",
        choices: ["一起蓋火車軌道", "一起去學校", "一起烤餅乾"],
        qT: "What will they do next weekend?",
        choicesT: ["Build a train track together", "Go to school together", "Bake cookies together"],
        answer: 0,
      },
    ],
  },
  {
    id: "en-r-night-market",
    language: "en",
    level: 3,
    title: "A Night at the Market",
    text: "Night markets are one of the best ways to experience local life in Taiwan. Most of them open around six in the evening and stay busy until midnight. Visitors can try dozens of snacks, such as grilled squid, oyster omelets and bubble tea, without spending much money. However, the crowds can be overwhelming on weekends, so many locals prefer to go on weekday nights. It is also a good idea to bring cash, because some small stalls still do not accept cards.",
    questions: [
      {
        q: "夜市大約幾點開始營業？",
        choices: ["中午", "傍晚六點左右", "午夜"],
        qT: "When do most night markets open?",
        choicesT: ["At noon", "Around six in the evening", "At midnight"],
        answer: 1,
      },
      {
        q: "為什麼很多當地人喜歡平日晚上去？",
        choices: ["東西比較便宜", "週末人太多", "週末不營業"],
        qT: "Why do many locals prefer weekday nights?",
        choicesT: ["Food is cheaper", "Weekends are too crowded", "Markets close on weekends"],
        answer: 1,
      },
      {
        q: "文章建議帶現金的原因是？",
        choices: ["有些小攤不收卡", "現金可以打折", "不能用手機付款"],
        qT: "Why should visitors bring cash?",
        choicesT: ["Some small stalls do not accept cards", "Cash gets a discount", "Phone payments are not allowed"],
        answer: 0,
      },
    ],
  },
  {
    id: "en-r-sleep",
    language: "en",
    level: 3,
    title: "Why Sleep Matters",
    text: "Many students stay up late to finish homework or play games, believing they can catch up on sleep during the weekend. Scientists say this habit does more harm than good. While we sleep, the brain sorts the information we learned during the day and stores the important parts as long-term memory. Without enough sleep, it becomes harder to concentrate, and we are more likely to make careless mistakes. Experts recommend that teenagers get eight to ten hours of sleep every night.",
    questions: [
      {
        q: "睡覺時大腦會做什麼？",
        choices: ["整理白天學到的東西", "完全停止工作", "忘掉所有事情"],
        qT: "What does the brain do while we sleep?",
        choicesT: ["It sorts what we learned during the day", "It stops working completely", "It forgets everything"],
        answer: 0,
      },
      {
        q: "睡眠不足會怎麼樣？",
        choices: ["比較容易專心", "比較容易粗心犯錯", "記憶力變好"],
        qT: "What happens without enough sleep?",
        choicesT: ["It is easier to concentrate", "We make more careless mistakes", "Our memory improves"],
        answer: 1,
      },
      {
        q: "專家建議青少年每晚睡多久？",
        choices: ["六到七小時", "八到十小時", "十二小時以上"],
        qT: "How much sleep do experts recommend for teenagers?",
        choicesT: ["Six to seven hours", "Eight to ten hours", "More than twelve hours"],
        answer: 1,
      },
    ],
  },
  {
    id: "en-r-remote-work",
    language: "en",
    level: 4,
    title: "Working from Home",
    text: "Since the pandemic, a growing number of companies have allowed employees to work from home at least part of the week. Supporters argue that remote work saves commuting time and gives people more control over their schedules. Critics, on the other hand, point out that it can blur the line between work and personal life, and that new employees may miss the informal learning that happens in an office. As a result, many organizations have settled on a hybrid model, asking staff to come in two or three days a week.",
    questions: [
      {
        q: "支持者認為在家工作的好處是？",
        choices: ["省下通勤時間", "薪水比較高", "不用開會"],
        qT: "According to supporters, what is one benefit of remote work?",
        choicesT: ["It saves commuting time", "It pays more", "There are no meetings"],
        answer: 0,
      },
      {
        q: "批評者擔心新進員工會錯過什麼？",
        choices: ["加班費", "在辦公室裡自然學到的東西", "公司旅遊"],
        qT: "What might new employees miss, according to critics?",
        choicesT: ["Overtime pay", "Informal learning in the office", "Company trips"],
        answer: 1,
      },
      {
        q: "很多公司最後採用什麼方式？",
        choices: ["全部回辦公室", "全部在家工作", "每週進辦公室兩三天的混合模式"],
        qT: "What have many organizations settled on?",
        choicesT: ["Everyone back in the office", "Fully remote work", "A hybrid model of two or three office days a week"],
        answer: 2,
      },
    ],
  },
  {
    id: "en-r-community-garden",
    language: "en",
    level: 4,
    title: "The Community Garden",
    text: "Two years ago, the empty lot behind our apartment building was full of weeds and broken bottles. Most residents simply walked past it without a second thought. Then Mrs. Chen, a retired science teacher on the third floor, asked the building manager whether the neighbors could turn it into a garden. The manager agreed on one condition: the residents had to take care of it themselves. At first, only five families signed up. They cleared the trash, built wooden boxes for the soil, and planted tomatoes, green onions, and sweet potatoes. By the end of the first summer, the garden was producing more vegetables than those families could eat, so they started leaving baskets of extra food in the lobby for anyone to take. Before long, more neighbors wanted to join. Today there are over twenty families involved, and the garden has become the place where people who used to be strangers stop to chat. Mrs. Chen says the vegetables are nice, but the friendships are the real harvest.",
    questions: [
      {
        q: "這塊空地原本是什麼樣子？",
        choices: ["停滿了車", "長滿雜草還有破瓶子", "是一個小公園", "正在蓋新大樓"],
        qT: "What was the empty lot like at first?",
        choicesT: [
          "It was full of cars.",
          "It was full of weeds and broken bottles.",
          "It was a small park.",
          "A new building was being built there.",
        ],
        answer: 1,
      },
      {
        q: "大樓管理員答應的條件是什麼？",
        choices: ["住戶要付租金", "只能種花", "住戶要自己照顧菜園", "每週要開會"],
        qT: "What condition did the building manager set?",
        choicesT: [
          "Residents had to pay rent.",
          "Only flowers could be planted.",
          "Residents had to take care of it themselves.",
          "There had to be a meeting every week.",
        ],
        answer: 2,
      },
      {
        q: "第一個夏天種出太多菜時，他們怎麼做？",
        choices: ["拿去市場賣", "放在大廳讓大家自由拿", "丟掉", "送給學校"],
        qT: "What did they do when the garden produced too many vegetables?",
        choicesT: [
          "They sold them at the market.",
          "They left them in the lobby for anyone to take.",
          "They threw them away.",
          "They gave them to a school.",
        ],
        answer: 1,
      },
      {
        q: "陳太太說的「真正的收穫」是指什麼？",
        choices: ["蔬菜", "省下的錢", "鄰居之間的友誼", "得到的獎項"],
        qT: 'What does Mrs. Chen mean by "the real harvest"?',
        choicesT: ["The vegetables", "The money they saved", "The friendships between neighbors", "The prizes they won"],
        answer: 2,
      },
    ],
  },
  {
    id: "en-r-phone-free-school",
    language: "en",
    level: 4,
    title: "A Phone-Free School Day",
    text: "Last semester, a junior high school in Taichung tried an experiment: students had to put their phones in a locked box when they arrived and could only take them back after the last class. Many students complained at first. Some said they needed their phones to contact their parents, so the school promised that teachers would pass on any urgent messages. After about a month, the teachers noticed several changes. Students talked to each other more during breaks, and fewer of them looked tired in the morning. Some even started playing basketball or board games at lunchtime instead of staring at screens. The results were not all positive, though. A few students said they felt anxious without their phones, and some parents worried that they could not reach their children directly. The school is now asking students and parents to help design a new rule that keeps the benefits while solving these problems.",
    questions: [
      {
        q: "學生什麼時候可以拿回手機？",
        choices: ["午餐時間", "最後一堂課結束後", "下課時間", "隔天早上"],
        qT: "When could students get their phones back?",
        choicesT: ["At lunchtime", "After the last class", "During breaks", "The next morning"],
        answer: 1,
      },
      {
        q: "學校怎麼解決學生要聯絡家長的問題？",
        choices: ["老師會轉達緊急訊息", "每班放一支電話", "允許學生帶手錶", "家長可以到學校"],
        qT: "How did the school deal with students needing to contact their parents?",
        choicesT: [
          "Teachers would pass on urgent messages.",
          "Each class got a phone.",
          "Students could wear smart watches.",
          "Parents could visit the school.",
        ],
        answer: 0,
      },
      {
        q: "下面哪一個「不是」老師注意到的改變？",
        choices: ["下課時學生更常聊天", "早上看起來累的學生變少", "考試成績大幅進步", "有些學生午餐時間去打籃球"],
        qT: "Which change did the teachers NOT mention?",
        choicesT: [
          "Students talked more during breaks.",
          "Fewer students looked tired in the morning.",
          "Test scores went up a lot.",
          "Some students played basketball at lunchtime.",
        ],
        answer: 2,
      },
      {
        q: "學校接下來打算怎麼做？",
        choices: ["取消這個規定", "請學生和家長一起設計新規定", "全校禁止手機", "只在考試週實施"],
        qT: "What is the school planning to do next?",
        choicesT: [
          "Cancel the rule",
          "Ask students and parents to help design a new rule",
          "Ban phones completely",
          "Use the rule only during exam weeks",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: "en-r-night-owls",
    language: "en",
    level: 5,
    title: "Are Teenagers Just Lazy?",
    text: "Parents often complain that teenagers stay up too late and are impossible to wake in the morning. It is tempting to blame video games or social media, and those certainly play a part. However, sleep researchers have found that there is also a biological reason. During adolescence, the body begins releasing melatonin, the hormone that makes us feel sleepy, about two hours later than it does in children or adults. In other words, a fifteen-year-old who is wide awake at eleven at night is not necessarily being stubborn; his or her internal clock has genuinely shifted. The problem is that school schedules have not shifted with it. In many countries, classes start before eight o'clock, which forces teenagers to get up when their bodies still think it is the middle of the night. The result is a generation of students who are chronically short of sleep, which has been linked to poorer concentration, weaker memory, and even a higher risk of car accidents among teenage drivers. Some school districts in the United States decided to test a simple solution: they moved the start of the school day to eight-thirty or later. Studies of these schools found that students slept longer on average, attendance improved, and grades rose slightly. Not everyone is convinced, however. Later start times can create problems for parents who need to drop their children off before work, and they push after-school activities such as sports later into the evening. Still, many experts argue that the evidence is strong enough to justify the change, and they encourage families to support teenagers' sleep in the meantime by limiting screens in the hour before bed.",
    questions: [
      {
        q: "根據研究，青少年晚睡的生理原因是什麼？",
        choices: ["他們比較不需要睡眠", "褪黑激素分泌時間比較晚", "他們晚餐吃太多", "他們白天運動不夠"],
        qT: "According to researchers, what is the biological reason teenagers stay up late?",
        choicesT: [
          "They need less sleep.",
          "Their bodies release melatonin later.",
          "They eat too much at dinner.",
          "They don't exercise enough during the day.",
        ],
        answer: 1,
      },
      {
        q: "作者說「a fifteen-year-old … is not necessarily being stubborn」，意思最接近哪一個？",
        choices: ["青少年其實都很固執", "晚睡不一定是故意不聽話", "十五歲的孩子都該早睡", "固執是遺傳的"],
        qT: 'What does the writer mean by saying a fifteen-year-old "is not necessarily being stubborn"?',
        choicesT: [
          "Teenagers are actually very stubborn.",
          "Staying up late is not always on purpose.",
          "Fifteen-year-olds should all go to bed early.",
          "Stubbornness is inherited.",
        ],
        answer: 1,
      },
      {
        q: "下面哪一個「不是」文中提到的睡眠不足後果？",
        choices: ["專注力變差", "記憶力變弱", "體重增加", "青少年開車更容易出車禍"],
        qT: "Which effect of lack of sleep is NOT mentioned?",
        choicesT: ["Poorer concentration", "Weaker memory", "Weight gain", "More car accidents among teenage drivers"],
        answer: 2,
      },
      {
        q: "美國一些學區延後上課後，研究發現了什麼？",
        choices: ["學生睡得比較久，出席率也提高", "學生成績大幅下降", "家長都很滿意", "學生更常玩電動"],
        qT: "What did studies find after some US districts started school later?",
        choicesT: [
          "Students slept longer and attendance improved.",
          "Grades dropped sharply.",
          "All parents were happy.",
          "Students played more video games.",
        ],
        answer: 0,
      },
      {
        q: "專家建議家庭在改變發生前先怎麼做？",
        choices: ["睡前一小時少用螢幕", "早上喝咖啡", "週末補眠", "晚上多運動"],
        qT: "What do experts suggest families do in the meantime?",
        choicesT: [
          "Limit screens in the hour before bed",
          "Drink coffee in the morning",
          "Catch up on sleep at weekends",
          "Exercise more at night",
        ],
        answer: 0,
      },
    ],
  },
  {
    id: "en-r-fast-fashion",
    language: "en",
    level: 5,
    title: "The Real Price of a Cheap T-shirt",
    text: "A T-shirt that costs less than a lunch box seems like a great deal. Over the past twenty years, clothing has become so cheap that many people buy new outfits every month and throw them away after wearing them only a few times. This business model, known as fast fashion, depends on producing huge quantities of clothes very quickly and at very low cost. The price on the tag, however, does not include the cost to the environment. Growing cotton requires enormous amounts of water; producing a single T-shirt can use more than two thousand liters, roughly what one person drinks in two years. Many cheap garments are also made from polyester, a type of plastic that releases tiny fibers into rivers and oceans every time it is washed. Then there is the waste. In some countries, the equivalent of a garbage truck full of clothes is burned or buried every second. There is a human cost as well. To keep prices low, factories in some developing countries pay workers very little and ask them to work long hours, sometimes in unsafe buildings. In response, a growing number of shoppers are changing their habits. Some buy second-hand clothes or swap items with friends, while others choose fewer, higher-quality pieces that last for years. Several brands have started repair services or take back old clothes for recycling. Critics point out that recycling technology is still limited and that the simplest solution is also the least profitable for companies: buying less.",
    questions: [
      {
        q: "「fast fashion」這種商業模式靠的是什麼？",
        choices: ["少量手工製作", "快速、低成本地大量生產", "只用環保材料", "只在網路販售"],
        qT: "What does the fast fashion business model depend on?",
        choicesT: [
          "Making small amounts by hand",
          "Producing huge quantities quickly and cheaply",
          "Using only eco-friendly materials",
          "Selling only online",
        ],
        answer: 1,
      },
      {
        q: "文中用「一個人兩年喝的水」來比喻什麼？",
        choices: ["做一件T恤用的水量", "洗衣服用的水量", "工廠一天用的水量", "種一棵樹用的水量"],
        qT: "What is compared to the amount of water one person drinks in two years?",
        choicesT: [
          "The water used to make one T-shirt",
          "The water used to wash clothes",
          "The water a factory uses in a day",
          "The water needed to grow a tree",
        ],
        answer: 0,
      },
      {
        q: "聚酯纖維衣服造成什麼問題？",
        choices: ["很容易起火", "每次洗都會把細小纖維排進河川和海洋", "穿起來很熱", "很難染色"],
        qT: "What problem does polyester clothing cause?",
        choicesT: [
          "It catches fire easily.",
          "It releases tiny fibers into rivers and oceans when washed.",
          "It is too hot to wear.",
          "It is hard to dye.",
        ],
        answer: 1,
      },
      {
        q: "下面哪一個「不是」文中提到消費者改變習慣的方式？",
        choices: ["買二手衣", "和朋友交換衣服", "買少一點但品質好的衣服", "自己在家種棉花"],
        qT: "Which of these is NOT mentioned as a way shoppers are changing their habits?",
        choicesT: [
          "Buying second-hand clothes",
          "Swapping clothes with friends",
          "Buying fewer, better-quality pieces",
          "Growing their own cotton",
        ],
        answer: 3,
      },
      {
        q: "作者認為最簡單的解決方法為什麼公司不喜歡？",
        choices: ["因為技術太難", "因為「少買」讓公司賺得最少", "因為政府禁止", "因為消費者不接受"],
        qT: "Why is the simplest solution unpopular with companies?",
        choicesT: [
          "The technology is too difficult.",
          "Buying less is the least profitable for them.",
          "The government bans it.",
          "Shoppers won't accept it.",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: "en-r-second-language",
    language: "en",
    level: 6,
    title: "Is It Ever Too Late to Learn a Language?",
    text: "It is widely believed that children are naturally better at learning languages than adults, and that anyone who starts after the age of twelve or so is doomed to speak with a heavy accent and make endless grammar mistakes. Like many popular beliefs, this one contains some truth but leaves out a great deal. Research does suggest that people who begin learning a language in early childhood are more likely to end up sounding like native speakers, particularly when it comes to pronunciation. Young children seem to be especially sensitive to the sounds of the languages around them, and this sensitivity gradually declines. A large study published in 2018, which analyzed grammar tests taken by more than half a million people, concluded that the ability to master grammar to a native-like level remains strong until around the age of seventeen. However, the same research makes an important distinction that is often overlooked: reaching native-like perfection is not the same as becoming a fluent, confident speaker. In fact, adults have several advantages over children. They already understand how language works in general, they can use reading and dictionaries to expand their vocabulary quickly, and they can deliberately analyze patterns that a child would absorb only after years of exposure. In classroom studies that compare learners over the first year or two, adults and teenagers often make faster progress than young children. What adults usually lack is not ability but time and conditions. A child living in a new country may hear the language for ten hours a day, play with classmates who speak nothing else, and feel no embarrassment about making mistakes. Most adults, by contrast, study for an hour or two a week, return home to their first language, and are often afraid of sounding foolish. Experts who study successful adult learners point to a few consistent habits: practicing a little every day rather than a lot once a week, listening to large amounts of material they find genuinely interesting, speaking out loud even when it feels uncomfortable, and focusing on being understood rather than on sounding perfect. An accent, they note, is not a sign of failure; millions of people use a second language every day at work and in their personal lives while sounding clearly foreign, and they communicate perfectly well. The more useful question, then, is not whether it is too late to start, but how to create the conditions that make steady progress possible.",
    questions: [
      {
        q: "根據文章，小時候開始學語言最明顯的優勢在哪方面？",
        choices: ["單字量", "發音", "閱讀速度", "寫作能力"],
        qT: "According to the passage, in which area do early learners have the clearest advantage?",
        choicesT: ["Vocabulary", "Pronunciation", "Reading speed", "Writing"],
        answer: 1,
      },
      {
        q: "2018 年那份研究被忽略的重要區別是什麼？",
        choices: ["男生和女生學得不一樣", "達到母語般完美不等於能流利自信地使用", "文法比單字重要", "在國外學比在國內學快"],
        qT: "What important distinction from the 2018 research is often overlooked?",
        choicesT: [
          "Boys and girls learn differently.",
          "Native-like perfection is not the same as being a fluent, confident speaker.",
          "Grammar matters more than vocabulary.",
          "Learning abroad is faster than learning at home.",
        ],
        answer: 1,
      },
      {
        q: "下面哪一個「不是」文中提到大人學語言的優勢？",
        choices: ["已經懂語言大致怎麼運作", "能用閱讀和字典快速增加單字", "能刻意分析句型", "耳朵對聲音比小孩敏感"],
        qT: "Which of these is NOT mentioned as an advantage adults have?",
        choicesT: [
          "They understand how language works in general.",
          "They can expand vocabulary quickly with reading and dictionaries.",
          "They can deliberately analyze patterns.",
          "Their ears are more sensitive to sounds than children's.",
        ],
        answer: 3,
      },
      {
        q: "作者認為大人最缺少的通常是什麼？",
        choices: ["天分", "時間和環境", "好老師", "記憶力"],
        qT: "According to the writer, what do adults usually lack?",
        choicesT: ["Talent", "Time and conditions", "Good teachers", "Memory"],
        answer: 1,
      },
      {
        q: "作者對「有口音」的看法是什麼？",
        choices: ["代表學習失敗", "一定要改掉才能工作", "不代表失敗，照樣可以好好溝通", "只有大人才會有"],
        qT: "What is the writer's view of having an accent?",
        choicesT: [
          "It is a sign of failure.",
          "It must be removed before you can work.",
          "It is not a failure; people still communicate well.",
          "Only adults have one.",
        ],
        answer: 2,
      },
    ],
  },
  {
    id: "ja-r-jikoshoukai",
    language: "ja",
    level: 1,
    title: "じこしょうかい",
    text: "はじめまして。わたしは けん です。たいわんから きました。ねこが すきです。どうぞ よろしく。",
    questions: [
      {
        q: "他叫什麼名字？",
        choices: ["けん", "ねこ", "たいわん"],
        qT: "なまえは なんですか。",
        choicesT: ["けん", "ねこ", "たいわん"],
        answer: 0,
      },
      {
        q: "他從哪裡來？",
        choices: ["日本", "台灣", "美國"],
        qT: "どこから きましたか。",
        choicesT: ["にほん", "たいわん", "アメリカ"],
        answer: 1,
      },
      {
        q: "他喜歡什麼？",
        choices: ["狗", "貓", "壽司"],
        qT: "なにが すきですか。",
        choicesT: ["いぬ", "ねこ", "すし"],
        answer: 1,
      },
    ],
  },
  {
    id: "ja-r-ramen",
    language: "ja",
    level: 1,
    title: "ラーメンや",
    text: "きょう ともだちと ラーメンやに いきました。ラーメンは おいしかったです。でも すこし たかかったです。",
    questions: [
      {
        q: "今天和誰去？",
        choices: ["老師", "朋友", "家人"],
        qT: "きょう だれと いきましたか。",
        choicesT: ["せんせい", "ともだち", "かぞく"],
        answer: 1,
      },
      {
        q: "拉麵怎麼樣？",
        choices: ["好吃", "難吃", "很冷"],
        qT: "ラーメンは どうでしたか。",
        choicesT: ["おいしかった", "まずかった", "つめたかった"],
        answer: 0,
      },
      {
        q: "價錢怎麼樣？",
        choices: ["很便宜", "有點貴", "免費"],
        qT: "ねだんは どうでしたか。",
        choicesT: ["やすかった", "すこし たかかった", "ただだった"],
        answer: 1,
      },
    ],
  },
];

export const READINGS: Reading[] = [...BASE_READINGS, ...EN_READINGS_MORE, ...JA_READINGS_MORE, ...ES_READINGS, ...CULTURE_READINGS].map((r) =>
  EXTRA_QUESTIONS[r.id] ? { ...r, questions: [...r.questions, ...EXTRA_QUESTIONS[r.id]] } : r,
);
