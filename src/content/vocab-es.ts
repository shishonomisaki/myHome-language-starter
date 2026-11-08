// 西班牙語入門字彙（L0 發音入門、L1 DELE A1、L2 DELE A2）。
// 格式：西語|中文|補充。名詞一律帶冠詞（el 陽性、la 陰性），學性別從第一天開始。
// 以拉美通用說法為主；西班牙另一種說法寫在補充（「西班牙：…」），只要認得。

import type { Level, StudyItem } from "@/lib/types";

const RAW: Record<number, string> = {
  0: `hola|你好|h 不發音
adiós|再見|重音在 ó
gracias|謝謝|
por favor|請|
sí|是|有重音符號的 sí 是「是」；si 是「如果」
no|不；不是|
buenos días|早安|
buenas tardes|午安|
buenas noches|晚安|
¿Qué tal?|你好嗎？|問句前面要倒問號 ¿
bien|好|
mal|不好|
perdón|對不起；借過|
de nada|不客氣|
me llamo...|我叫…|ll 唸像 y
mucho gusto|很高興認識你|
uno|一|
dos|二|
tres|三|r 輕彈一下
cuatro|四|
cinco|五|拉美 c 唸 s；西班牙唸像英文 th
seis|六|
siete|七|
ocho|八|ch 像「七」的音
nueve|九|
diez|十|
el niño|男孩|ñ 唸像「尼（ㄋㄧ）」
la niña|女孩|
el año|年|año（年）和 ano 意思完全不同，ñ 不能少
mañana|明天；早上|
la mamá|媽媽|
el papá|爸爸|
el perro|狗|rr 要捲舌連續彈
el pero|但是|單一 r：pero（但是）≠ perro（狗）
la casa|房子；家|
el agua|水|陰性名詞，但前面用 el（因為 a 開頭重音）
la leche|牛奶|
el pan|麵包|
el café|咖啡|
el té|茶|
el gato|貓|ga 唸「嘎」
la gente|人們|ge、gi 的 g 唸喉音 h
la jirafa|長頸鹿|j 唸喉音 h
la llave|鑰匙|ll 唸像 y
la vaca|母牛|v 和 b 唸法一樣
la boca|嘴巴|
el queso|起司|que 唸「給」，u 不發音
la ciudad|城市|`,
  1: `yo|我|
tú|你|有重音的 tú 是「你」；tu 是「你的」
él|他|有重音的 él 是「他」；el 是冠詞
ella|她|
nosotros|我們|
ustedes|你們|拉美一律用 ustedes；西班牙的 vosotros 認得就好
usted|您|
ser|是（本質、身分）|soy, eres, es, somos, son
estar|是；在（狀態、位置）|estoy, estás, está, estamos, están
tener|有|tengo, tienes, tiene, tenemos, tienen
hablar|說（語言）|hablo, hablas, habla — -ar 規則動詞
comer|吃|como, comes, come — -er 規則動詞
vivir|住|vivo, vives, vive — -ir 規則動詞
beber|喝|
ir|去|voy, vas, va, vamos, van
querer|想要；愛|quiero, quieres, quiere
gustar|喜歡|me gusta el café（咖啡讓我喜歡）
trabajar|工作|
estudiar|讀書|
el hermano|哥哥；弟弟|
la hermana|姊姊；妹妹|
el hijo|兒子|
la hija|女兒|
el esposo|丈夫|
la esposa|妻子|
la familia|家人|
el amigo|朋友（男）|
la amiga|朋友（女）|
el maestro|老師（男）|
la maestra|老師（女）|西班牙常說 profesora
la escuela|學校|
el trabajo|工作|
la comida|食物；午餐|
el desayuno|早餐|
la cena|晚餐|
la fruta|水果|
la manzana|蘋果|
el pollo|雞肉|
el arroz|米飯|
la carne|肉|
el pescado|魚（食物）|
el jugo|果汁|西班牙：el zumo
la cuenta|帳單|
el baño|廁所；浴室|
el hotel|飯店|h 不發音
el restaurante|餐廳|
la calle|街道|
el libro|書|
la mesa|桌子|
la puerta|門|
grande|大的|
pequeño|小的|陰性 pequeña
bueno|好的|陰性 buena
malo|壞的|陰性 mala
bonito|漂亮的|陰性 bonita
caro|貴的|
barato|便宜的|
hoy|今天|
ayer|昨天|
ahora|現在|
aquí|這裡|
allí|那裡|
¿dónde?|哪裡？|疑問詞都有重音符號
¿cuándo?|什麼時候？|
¿cuánto?|多少？|
¿qué?|什麼？|
¿quién?|誰？|
¿por qué?|為什麼？|回答「因為」是 porque（連寫、沒重音）
el lunes|星期一|
el sábado|星期六|
el domingo|星期日|`,
  2: `hacer|做；製作|hago, haces, hace
poder|能夠|puedo, puedes, puede（o→ue）
salir|出去；出發|salgo, sales, sale
venir|來|vengo, vienes, viene
llegar|到達|
comprar|買|
pagar|付錢|
viajar|旅行|
conocer|認識（人、地方）|conozco
saber|知道（事情）|sé, sabes, sabe
pensar|想；認為|pienso, piensas（e→ie）
dormir|睡覺|duermo, duermes（o→ue）
levantarse|起床|me levanto（反身動詞）
llamarse|叫做…|me llamo, te llamas, se llama
el viaje|旅行|
el aeropuerto|機場|
el avión|飛機|
el tren|火車|
el autobús|公車|墨西哥常說 el camión
el carro|車子|西班牙：el coche
el boleto|票|西班牙：el billete
la maleta|行李箱|
el mapa|地圖|陽性，雖然 a 結尾
el día|天；日子|陽性，雖然 a 結尾
la mano|手|陰性，雖然 o 結尾
el problema|問題|陽性，雖然 a 結尾
la computadora|電腦|西班牙：el ordenador
el celular|手機|西班牙：el móvil
la playa|海灘|
la montaña|山|
el tiempo|天氣；時間|
hace calor|天氣熱|
hace frío|天氣冷|
llueve|下雨|
el verano|夏天|
el invierno|冬天|
la ropa|衣服|
los zapatos|鞋子|
la camisa|襯衫|
la tienda|商店|
el mercado|市場|
la farmacia|藥局|
el hospital|醫院|h 不發音
el médico|醫生|
me duele...|我的…痛|me duele la cabeza（我頭痛）
cansado|累的|陰性 cansada；用 estar
contento|開心的|陰性 contenta；用 estar
siempre|總是|
nunca|從不|
a veces|有時候|
temprano|早|
tarde|晚；下午|
mucho|很多|
poco|一點點|
también|也|
pero|但是|
porque|因為|
después|之後|
antes|之前|
la película|電影|
la música|音樂|
el fin de semana|週末|`,
};

export const ES_VOCAB: StudyItem[] = Object.entries(RAW).flatMap(([lvl, text]) =>
  text.split("\n").map((line) => {
    const [word, zh, note] = line.split("|");
    return {
      id: `es-vocab-${word}`,
      language: "es" as const,
      skill: "vocab" as const,
      level: Number(lvl) as Level,
      prompt: word,
      answer: zh,
      extra: note || undefined,
      speak: word.replace(/\.\.\.$/, ""),
    };
  }),
);
