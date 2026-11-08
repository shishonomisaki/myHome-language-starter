// 英語字彙（L0–L6，L3 以上每級 30 字供分級測驗與練習）。格式：英文|中文；之後由後台匯入完整英檢字表。

import type { Level, StudyItem } from "@/lib/types";
import { WORD_PARTS } from "./word-parts";

const RAW: Record<number, string> = {
  0: `apple|蘋果
book|書
cat|貓
dog|狗
egg|蛋
fish|魚
hat|帽子
milk|牛奶
pen|筆
red|紅色
blue|藍色
one|一
two|二
three|三
mom|媽媽
dad|爸爸
yes|是
no|不
hello|你好
bye|再見
sun|太陽
car|車子
bag|包包
cup|杯子
big|大的
small|小的
happy|開心的
sad|難過的
eat|吃
run|跑`,
  1: `school|學校
teacher|老師
student|學生
friend|朋友
family|家人
brother|哥哥；弟弟
sister|姊姊；妹妹
water|水
rice|米飯
bread|麵包
breakfast|早餐
lunch|午餐
dinner|晚餐
morning|早上
night|晚上
today|今天
tomorrow|明天
week|星期
rain|雨
cold|冷的
hot|熱的
play|玩
read|讀
write|寫
sing|唱歌
swim|游泳
walk|走路
sleep|睡覺
house|房子
room|房間
door|門
window|窗戶
desk|書桌
chair|椅子
park|公園
store|商店
bike|腳踏車
bus|公車
color|顏色
animal|動物`,
  2: `library|圖書館
hospital|醫院
restaurant|餐廳
weather|天氣
season|季節
vacation|假期
hobby|嗜好
favorite|最喜歡的
interesting|有趣的
important|重要的
different|不同的
difficult|困難的
easy|簡單的
famous|有名的
careful|小心的
believe|相信
decide|決定
remember|記得
forget|忘記
borrow|借入
practice|練習
prepare|準備
travel|旅行
visit|拜訪
invite|邀請
answer|回答
question|問題
problem|問題；麻煩
reason|理由
example|例子
future|未來
history|歷史
science|科學
health|健康
habit|習慣
neighbor|鄰居
country|國家
culture|文化
language|語言
dictionary|字典`,
  3: `available|可取得的
convenient|方便的
environment|環境
experience|經驗
government|政府
improve|改善
increase|增加
opportunity|機會
pollution|污染
recently|最近
suggest|建議
temperature|溫度
traditional|傳統的
achieve|達成
advertisement|廣告
ancient|古代的
appreciate|感激
compare|比較
competition|比賽
describe|描述
discussion|討論
equipment|設備
explain|解釋
familiar|熟悉的
generation|世代
journey|旅程
manage|處理；設法
prevent|預防
recommend|推薦
responsible|負責的`,
  4: `abandon|放棄
accurate|準確的
acknowledge|承認
adequate|足夠的
anticipate|預期
approximately|大約
assess|評估
beneficial|有益的
circumstance|情況
collapse|倒塌；崩潰
comprehensive|全面的
consequence|後果
controversial|有爭議的
crucial|關鍵的
decline|下降；婉拒
emphasize|強調
estimate|估計
evaluate|評價
evident|明顯的
exaggerate|誇大
fundamental|基本的
hesitate|猶豫
inevitable|不可避免的
interfere|干涉
mature|成熟的
negotiate|談判
obstacle|障礙
persuade|說服
reluctant|不情願的
substantial|大量的`,
  5: `ambiguous|模稜兩可的
arbitrary|任意的；武斷的
compelling|令人信服的
complacent|自滿的
conspicuous|顯眼的
deteriorate|惡化
diligent|勤勉的
discrepancy|差異；不一致
eloquent|有說服力的；口才好的
exemplify|作為…的典範
feasible|可行的
hypothetical|假設的
impartial|公正的
incentive|誘因
indispensable|不可或缺的
meticulous|一絲不苟的
mitigate|減輕
notorious|惡名昭彰的
obsolete|過時的
plausible|看似合理的
prevalent|普遍的
prudent|謹慎的
reconcile|調和；和解
redundant|多餘的
scrutinize|仔細檢查
skeptical|懷疑的
spontaneous|自發的
tentative|暫定的
undermine|削弱
versatile|多才多藝的；多用途的`,
  6: `acquiesce|默許
anachronism|不合時代的事物
cajole|哄騙
capricious|反覆無常的
circumvent|規避
cogent|有說服力的
convoluted|錯綜複雜的
deleterious|有害的
didactic|說教的
disparage|貶低
ephemeral|短暫的
equivocal|含糊其辭的
exacerbate|使惡化
fastidious|挑剔的
gregarious|愛交際的
idiosyncrasy|特質；怪癖
innocuous|無害的
intransigent|不妥協的
juxtapose|並列
laconic|簡潔的；話少的
obfuscate|使混淆
ostensibly|表面上
pragmatic|務實的
quintessential|典型的
recalcitrant|頑抗的
sanguine|樂觀的
superfluous|多餘的
tenuous|薄弱的
ubiquitous|無所不在的
vindicate|證明…無辜或正確`,
};

export const EN_VOCAB: StudyItem[] = Object.entries(RAW).flatMap(([lvl, text]) =>
  text.split("\n").map((line) => {
    const [word, zh] = line.split("|");
    return {
      id: `en-vocab-${word}`,
      language: "en" as const,
      skill: "vocab" as const,
      level: Number(lvl) as Level,
      prompt: word,
      answer: zh,
      ...(WORD_PARTS[word] && { parts: WORD_PARTS[word] }),
    };
  }),
);
