// 西語分級短文（L0–L2，拉美通用說法）。閱讀與聽力共用，朗讀走全站卡拉OK亮燈。
// Claude 以資深西語老師標準撰寫與審稿；家長抽查。

import type { Reading } from "./readings";

const r = (
  id: string,
  level: 0 | 1 | 2,
  title: string,
  text: string,
  questions: [string, string[], string, string[], number][],
  region?: string,
): Reading => ({
  id: `es-r-${id}`,
  language: "es",
  level,
  title,
  text,
  region,
  questions: questions.map(([q, choices, qT, choicesT, answer]) => ({ q, choices, qT, choicesT, answer })),
});

export const ES_READINGS: Reading[] = [
  r("hola", 0, "Hola", "Hola. Me llamo Ana. Soy de México. Mucho gusto. ¿Y tú? ¿Cómo te llamas?", [
    ["她叫什麼名字？", ["Ana", "María", "Rosa"], "¿Cómo se llama?", ["Ana", "María", "Rosa"], 0],
    ["她是哪裡人？", ["西班牙", "墨西哥", "台灣"], "¿De dónde es?", ["De España", "De México", "De Taiwán"], 1],
    ["她說了哪句客套話？", ["很高興認識你", "謝謝", "對不起"], "¿Qué dice Ana?", ["Mucho gusto", "Gracias", "Perdón"], 0],
    ["最後她問了什麼？", ["你幾歲？", "你叫什麼名字？", "你住哪裡？"], "¿Qué pregunta al final?", ["¿Cuántos años tienes?", "¿Cómo te llamas?", "¿Dónde vives?"], 1],
  ]),
  r("mi-casa", 0, "Mi casa", "Mi casa es pequeña. Tengo un perro y un gato. El perro se llama Toby. El gato es negro.", [
    ["房子怎麼樣？", ["很大", "很小", "很新"], "¿Cómo es la casa?", ["Grande", "Pequeña", "Nueva"], 1],
    ["狗叫什麼名字？", ["Toby", "Max", "Luna"], "¿Cómo se llama el perro?", ["Toby", "Max", "Luna"], 0],
    ["貓是什麼顏色？", ["白色", "黑色", "灰色"], "¿De qué color es el gato?", ["Blanco", "Negro", "Gris"], 1],
    ["她有幾隻動物？", ["一隻", "兩隻", "三隻"], "¿Cuántos animales tiene?", ["Uno", "Dos", "Tres"], 1],
  ]),
  r("cafe", 0, "En el café", "—Buenos días. Un café, por favor. —¿Con leche? —Sí, con leche. Gracias. —De nada.", [
    ["客人點了什麼？", ["茶", "咖啡", "果汁"], "¿Qué pide?", ["Un té", "Un café", "Un jugo"], 1],
    ["要加什麼？", ["牛奶", "糖", "什麼都不加"], "¿Con qué?", ["Con leche", "Con azúcar", "Con nada"], 0],
    ["這是什麼時候？", ["早上", "下午", "晚上"], "¿Cuándo es?", ["En la mañana", "En la tarde", "En la noche"], 0],
    ["「De nada」是什麼意思？", ["不客氣", "沒有了", "再見"], "¿Qué significa «de nada»?", ["不客氣", "沒有了", "再見"], 0],
  ]),
  r("familia", 1, "Mi familia", "Somos cuatro en mi familia. Mi esposo trabaja en una oficina. Tenemos dos hijos. Los niños estudian en la escuela. Los domingos comemos juntos en casa de mi mamá.", [
    ["家裡有幾個人？", ["三個", "四個", "五個"], "¿Cuántos son en la familia?", ["Tres", "Cuatro", "Cinco"], 1],
    ["孩子們在做什麼？", ["工作", "在學校讀書", "旅行"], "¿Qué hacen los niños?", ["Trabajan", "Estudian en la escuela", "Viajan"], 1],
    ["星期日他們在哪裡吃飯？", ["餐廳", "媽媽家", "學校"], "¿Dónde comen los domingos?", ["En un restaurante", "En casa de la mamá", "En la escuela"], 1],
    ["先生在哪裡工作？", ["學校", "辦公室", "醫院"], "¿Dónde trabaja el esposo?", ["En una escuela", "En una oficina", "En un hospital"], 1],
  ]),
  r("dia", 1, "Un día normal", "Me levanto a las siete. Desayuno pan con café. Voy al trabajo en autobús. Como a la una. En la noche, ceno con mi familia y leo un libro.", [
    ["她幾點起床？", ["六點", "七點", "八點"], "¿A qué hora se levanta?", ["A las seis", "A las siete", "A las ocho"], 1],
    ["她怎麼去上班？", ["開車", "走路", "搭公車"], "¿Cómo va al trabajo?", ["En carro", "A pie", "En autobús"], 2],
    ["晚上她做什麼？", ["看電影", "看書", "跑步"], "¿Qué hace en la noche?", ["Ve una película", "Lee un libro", "Corre"], 1],
    ["早餐吃什麼？", ["麵包配咖啡", "米飯", "水果"], "¿Qué desayuna?", ["Pan con café", "Arroz", "Fruta"], 0],
  ]),
  r("mercado", 1, "En el mercado", "—¿Cuánto cuestan las manzanas? —Veinte pesos el kilo. —Quiero dos kilos, por favor. —Aquí tiene. Son cuarenta pesos. —Gracias.", [
    ["她買什麼？", ["香蕉", "蘋果", "麵包"], "¿Qué compra?", ["Plátanos", "Manzanas", "Pan"], 1],
    ["她總共付多少錢？", ["20 披索", "40 披索", "2 披索"], "¿Cuánto paga?", ["Veinte pesos", "Cuarenta pesos", "Dos pesos"], 1],
    ["一公斤蘋果多少錢？", ["10 披索", "20 披索", "40 披索"], "¿Cuánto cuesta el kilo?", ["Diez pesos", "Veinte pesos", "Cuarenta pesos"], 1],
    ["她買幾公斤？", ["一公斤", "兩公斤", "四公斤"], "¿Cuántos kilos quiere?", ["Uno", "Dos", "Cuatro"], 1],
  ], "墨西哥"),
  r("viaje", 2, "Un viaje a Madrid", "El verano pasado viajé a Madrid con mi hermana. Llegamos en avión y tomamos el metro al hotel. En España dicen «coche» y no «carro», y usan «vosotros». Comimos tortilla de patatas y visitamos el Museo del Prado. Fue un viaje muy bonito.", [
    ["她和誰去旅行？", ["先生", "姊妹", "朋友"], "¿Con quién viajó?", ["Con su esposo", "Con su hermana", "Con una amiga"], 1],
    ["在西班牙，「車子」常說什麼？", ["carro", "coche", "camión"], "¿Qué palabra usan en España para «carro»?", ["carro", "coche", "camión"], 1],
    ["她們參觀了哪裡？", ["普拉多美術館", "海灘", "動物園"], "¿Qué visitaron?", ["El Museo del Prado", "La playa", "El zoológico"], 0],
    ["她們怎麼到馬德里？", ["坐飛機", "坐火車", "開車"], "¿Cómo llegaron a Madrid?", ["En avión", "En tren", "En carro"], 0],
    ["她們吃了什麼？", ["西班牙馬鈴薯烘蛋", "墨西哥捲餅", "海鮮飯"], "¿Qué comieron?", ["Tortilla de patatas", "Tacos", "Paella"], 0],
  ], "西班牙"),
  r("doctor", 2, "En el médico", "Ayer no fui al trabajo porque estaba enferma. Me dolía la cabeza y tenía fiebre. El médico me dijo: «Tiene que descansar y beber mucha agua». Hoy estoy mejor.", [
    ["她昨天為什麼沒去上班？", ["生病", "旅行", "下雨"], "¿Por qué no fue al trabajo?", ["Estaba enferma", "Estaba de viaje", "Llovía"], 0],
    ["醫生說要做什麼？", ["吃藥打針", "休息多喝水", "去運動"], "¿Qué dijo el médico?", ["Tomar medicinas", "Descansar y beber agua", "Hacer ejercicio"], 1],
    ["她今天怎麼樣？", ["比較好", "更糟", "一樣"], "¿Cómo está hoy?", ["Mejor", "Peor", "Igual"], 0],
    ["她哪裡痛？", ["肚子", "頭", "腳"], "¿Qué le dolía?", ["El estómago", "La cabeza", "El pie"], 1],
    ["她還有什麼症狀？", ["發燒", "咳嗽", "流鼻血"], "¿Qué más tenía?", ["Fiebre", "Tos", "Sangre en la nariz"], 0],
  ]),
];
