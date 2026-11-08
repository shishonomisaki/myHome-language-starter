// 英文單字的字首、字根、字尾拆解，學新字時一起看比較好記。只收拆得出意思的字，等家長審閱。
// 格式：「部分:意思」用空白隔開；字首寫成 xx-，字尾寫成 -xx，中間的是字根。

import type { WordPart } from "@/lib/types";

const RAW = `breakfast|break:打破 fast:禁食
important|im-:進入 port:搬運 -ant:…的
different|dif-:分開 fer:帶 -ent:…的
difficult|dif-:不 ficult:容易做的
careful|care:小心 -ful:充滿…的
remember|re-:再 member:記住
prepare|pre-:事先 pare:準備
dictionary|dict:說 -ion:名詞 -ary:…的書
neighbor|neigh:近 bor:住的人
vacation|vac:空 -ation:名詞
famous|fam:名聲 -ous:…的
question|quest:尋求 -ion:名詞
science|sci:知道 -ence:名詞
health|heal:治癒 -th:名詞
library|libr:書 -ary:…的地方
restaurant|re-:再 staur:恢復 -ant:…的地方
visit|vis:看 it:去
decide|de-:離開 cide:切
culture|cult:耕種 -ure:名詞
language|langu:舌頭 -age:名詞
available|a-:向 vail:有價值 -able:可…的
convenient|con-:一起 ven:來 -ient:…的
environment|en-:在…裡 viron:圍繞 -ment:名詞
experience|ex-:出 peri:嘗試 -ence:名詞
government|govern:統治 -ment:名詞
increase|in-:向內 crease:成長
opportunity|op-:朝向 port:港口 -unity:名詞
pollution|pol-:徹底 lut:弄髒 -ion:名詞
recently|recent:最近的 -ly:副詞
suggest|sug-:在下面 gest:帶
temperature|temper:調和 -ature:名詞
traditional|tra-:跨越 dit:給 -ion:名詞 -al:…的
advertisement|ad-:向 vert:轉 -ise:動詞 -ment:名詞
appreciate|ap-:向 preci:價值 -ate:動詞
compare|com-:一起 pare:相等
competition|com-:一起 pet:追求 -ition:名詞
describe|de-:向下 scribe:寫
discussion|dis-:分開 cuss:敲打 -ion:名詞
equipment|equip:配備 -ment:名詞
explain|ex-:出 plain:平、清楚
familiar|famil:家 -iar:…的
generation|gener:產生 -ation:名詞
prevent|pre-:事先 vent:來
recommend|re-:再 commend:託付
responsible|re-:回 spons:承諾 -ible:能…的
accurate|ac-:向 cur:照料 -ate:…的
adequate|ad-:向 equ:相等 -ate:…的
anticipate|anti-:之前 cip:拿 -ate:動詞
approximately|ap-:向 proxim:接近 -ate:…的 -ly:副詞
beneficial|bene:好 fic:做 -ial:…的
circumstance|circum-:周圍 stance:站
collapse|col-:一起 lapse:滑落
comprehensive|com-:完全 prehens:抓住 -ive:…的
consequence|con-:一起 sequ:跟隨 -ence:名詞
controversial|contro-:相反 vers:轉 -ial:…的
crucial|cruc:十字 -ial:…的
decline|de-:向下 cline:傾斜
evaluate|e-:出 valu:價值 -ate:動詞
evident|e-:出 vid:看 -ent:…的
exaggerate|ex-:加強 agger:堆高 -ate:動詞
fundamental|fundament:基礎 -al:…的
inevitable|in-:不 e-:出 vit:避開 -able:可…的
interfere|inter-:之間 fere:打
negotiate|neg-:不 oti:空閒 -ate:動詞
obstacle|ob-:對著 sta:站 -cle:名詞
persuade|per-:徹底 suade:勸
reluctant|re-:反 luct:掙扎 -ant:…的
substantial|sub-:在下面 stant:站 -ial:…的
ambiguous|ambi-:兩邊 gu:驅使 -ous:…的
compelling|com-:加強 pell:推 -ing:…的
complacent|com-:加強 plac:取悅 -ent:…的
conspicuous|con-:加強 spic:看 -uous:…的
deteriorate|deterior:更壞 -ate:動詞
eloquent|e-:出 loqu:說 -ent:…的
exemplify|exempl:例子 -ify:使成為
feasible|feas:做 -ible:能…的
hypothetical|hypo-:在下面 thet:放 -ical:…的
impartial|im-:不 part:一方 -ial:…的
indispensable|in-:不 dis-:分開 pens:秤 -able:可…的
notorious|not:知道 -orious:…的
plausible|plaus:鼓掌 -ible:能…的
prevalent|pre-:在前 val:強 -ent:…的
reconcile|re-:再 concile:聚在一起
redundant|red-:再 und:波浪、溢出 -ant:…的
tentative|tent:嘗試 -ative:…的
undermine|under-:在下面 mine:挖
versatile|vers:轉 -atile:能…的
anachronism|ana-:逆 chron:時間 -ism:名詞
circumvent|circum-:周圍 vent:走
convoluted|con-:一起 volut:捲 -ed:…的
disparage|dis-:分開 par:同等 -age:動詞
ephemeral|ep-:在…上 hemer:一天 -al:…的
equivocal|equi-:相等 voc:聲音 -al:…的
exacerbate|ex-:加強 acerb:苦澀 -ate:使
gregarious|greg:群 -arious:…的
idiosyncrasy|idio-:自己的 syn-:一起 crasy:混合
innocuous|in-:不 nocu:傷害 -ous:…的
intransigent|in-:不 transig:妥協 -ent:…的
juxtapose|juxta-:旁邊 pose:放
obfuscate|ob-:加強 fusc:暗 -ate:使
quintessential|quint:第五 essent:本質 -ial:…的
recalcitrant|re-:往後 calcitr:踢 -ant:…的
superfluous|super-:超過 flu:流 -ous:…的
tenuous|tenu:薄 -ous:…的
ubiquitous|ubiqu:到處 -itous:…的`;

export const WORD_PARTS: Record<string, WordPart[]> = Object.fromEntries(
  RAW.split("\n").map((line) => {
    const [word, parts] = line.split("|");
    return [
      word,
      parts.split(" ").map((p) => {
        const [text, meaning] = p.split(":");
        const kind = text.endsWith("-") ? "prefix" : text.startsWith("-") ? "suffix" : "root";
        return { text, meaning, kind } as WordPart;
      }),
    ];
  }),
);
