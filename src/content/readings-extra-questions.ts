// 理解題補強（2026-11-01 原本每篇 3 題略少）。0–1 級補到 4 題，2 級以上補到 5 題。
// 依短文 id 接在原有題目後面；新短文請直接把題目寫在短文裡。

import type { ReadingQuestion } from "./readings";

const Q = (q: string, choices: string[], qT: string, choicesT: string[], answer: number): ReadingQuestion => ({ q, choices, qT, choicesT, answer });

export const EXTRA_QUESTIONS: Record<string, ReadingQuestion[]> = {
  // ── 英文 L0 ──
  "en-r-my-cat": [Q("貓是大的還是小的？", ["大的", "小的", "很胖"], "Is the cat big or small?", ["Big", "Small", "Fat"], 1)],
  "en-r-my-family": [Q("家裡有誰？", ["爸爸和媽媽", "爺爺和奶奶", "叔叔和阿姨"], "Who is in my family?", ["A dad and a mom", "A grandpa and a grandma", "An uncle and an aunt"], 0)],
  "en-r-red-apple": [Q("蘋果大還是小？", ["小", "大", "沒有說"], "Is the apple big or small?", ["Small", "Big", "It doesn't say"], 1)],
  "en-r-rainy-day": [Q("我的鞋子怎麼了？", ["不見了", "濕了", "破了"], "What happens to my shoes?", ["They are lost", "They are wet", "They are broken"], 1)],
  "en-r-my-bag": [Q("書包裡還有什麼吃的東西？", ["便當盒", "蘋果", "麵包"], "What else is in the bag for food?", ["A lunch box", "An apple", "Some bread"], 0)],
  "en-r-at-the-zoo": [Q("猴子怎麼樣？", ["很兇", "很好笑", "很大"], "What are the monkeys like?", ["Angry", "Funny", "Big"], 1)],
  // ── 英文 L1 ──
  "en-r-sunday": [Q("哥哥早餐吃什麼？", ["麵包和牛奶", "飯和蛋", "麵"], "What does her brother have for breakfast?", ["Bread and milk", "Rice and eggs", "Noodles"], 1)],
  "en-r-birthday": [Q("Lily 收到什麼禮物？", ["新書和粉紅色包包", "一隻小狗", "腳踏車"], "What gifts does Lily get?", ["A new book and a pink bag", "A puppy", "A bike"], 0)],
  "en-r-weekend-cook": [Q("誰切菜？", ["我", "爸爸", "姊姊"], "Who cuts the vegetables?", ["I do", "Dad", "My sister"], 1)],
  "en-r-bus-to-school": [Q("Ben 喜歡坐在哪裡？", ["窗戶旁邊", "最後面", "司機旁邊"], "Where does Ben like to sit?", ["By the window", "At the back", "Next to the driver"], 0)],
  "en-r-beach-day": [Q("媽媽在海邊做什麼？", ["游泳", "在大傘下看書", "堆沙堡"], "What does Mom do at the beach?", ["She swims", "She reads under a big umbrella", "She builds a sand castle"], 1)],
  "en-r-lost-cat": [Q("誰找到 Mimi？", ["爸爸", "姊姊", "我"], "Who finds Mimi?", ["Dad", "My sister", "I do"], 1)],
  "en-c-trick-or-treat": [Q("在台灣，很多家庭在鬼月會做什麼？", ["擺食物給好兄弟", "穿奇裝異服", "送糖果"], "What do many families in Taiwan do in Ghost Month?", ["Put food out for the spirits", "Wear costumes", "Give out candy"], 0)],
  "en-c-magic-words": [Q("孩子要水時怎麼說比較有禮貌？", ["Water!", "Can I have some water, please?", "Give me water."], "How does the child ask for water politely?", ["Water!", "Can I have some water, please?", "Give me water."], 1)],
  // ── 英文 L2 ──
  "en-r-library": [
    Q("Tom 什麼時候去圖書館？", ["放學後", "早上上課前", "週末"], "When does Tom go to the library?", ["After school", "Before school", "On the weekend"], 0),
    Q("書要在多久內還？", ["一週", "兩週", "一個月"], "When must he return the book?", ["In one week", "In two weeks", "In one month"], 1),
  ],
  "en-r-new-neighbor": [
    Q("Ken 和我是什麼關係？", ["同年級但不同學校", "同班同學", "表兄弟"], "How is Ken related to me?", ["Same grade, different school", "Same class", "Cousins"], 0),
    Q("Ken 給我看了什麼？", ["模型火車", "他的狗", "電玩"], "What did Ken show me?", ["His model trains", "His dog", "His video games"], 0),
  ],
  "en-r-school-trip": [
    Q("他們在農場做了哪兩件事？", ["摘草莓、餵山羊", "騎馬、釣魚", "種樹、游泳"], "What did they do at the farm?", ["Picked strawberries and fed the goats", "Rode horses and fished", "Planted trees and swam"], 0),
    Q("這趟旅行感覺怎麼樣？", ["很累但很好玩", "很無聊", "很可怕"], "How was the trip?", ["Hard work but fun", "Boring", "Scary"], 0),
  ],
  "en-r-piano": [
    Q("Sara 一開始為什麼不喜歡練琴？", ["想出去和朋友玩", "老師很兇", "鋼琴壞了"], "Why didn't Sara like practicing at first?", ["She wanted to play outside", "Her teacher was mean", "The piano was broken"], 0),
    Q("Sara 現在幾歲？", ["七歲", "十歲", "十二歲"], "How old is Sara now?", ["Seven", "Ten", "Twelve"], 2),
  ],
  "en-r-typhoon": [
    Q("他們在窗戶上做了什麼？", ["貼膠帶", "畫畫", "掛窗簾"], "What did they put on the windows?", ["Tape", "Pictures", "Curtains"], 0),
    Q("停電多久？", ["兩小時", "一整天", "十分鐘"], "How long was the power out?", ["Two hours", "All day", "Ten minutes"], 0),
  ],
  "en-r-pen-pal": [
    Q("Yui 告訴我什麼？", ["她的學校和喜歡的動畫", "台灣的食物", "她的寵物"], "What does Yui tell me about?", ["Her school and favorite anime", "Taiwanese food", "Her pet"], 0),
    Q("我告訴 Yui 什麼？", ["日本動畫", "台灣的食物", "我的學校"], "What do I tell Yui about?", ["Japanese anime", "Taiwanese food", "My school"], 1),
  ],
  "en-c-opening-gifts": [
    Q("當場打開禮物後，他們常會說什麼？", ["I love it! Thank you so much.", "How much was it?", "I have one already."], "What do they often say after opening a gift?", ["I love it! Thank you so much.", "How much was it?", "I have one already."], 0),
    Q("這篇文章主要在說什麼？", ["送禮要送貴的", "不同地方拆禮物的習慣不同", "不要送禮物"], "What is the main idea?", ["Gifts should be expensive", "Places have different gift customs", "Don't give gifts"], 1),
  ],
  "en-c-queue": [
    Q("英國人在哪裡會安靜排隊？", ["公車站和商店", "只在學校", "只在家裡"], "Where do British people wait quietly?", ["At bus stops and in shops", "Only at school", "Only at home"], 0),
    Q("有人插隊時，很多英國人會怎樣？", ["大聲吼叫", "不一定大叫，但看起來不高興", "跟著插隊"], "How do many people react when someone cuts in?", ["They shout loudly", "They may not shout, but look upset", "They cut in too"], 1),
  ],
  // ── 英文 L3 ──
  "en-r-night-market": [
    Q("夜市大約營業到幾點？", ["晚上九點", "午夜", "早上"], "Until when do night markets stay busy?", ["9 p.m.", "Midnight", "Morning"], 1),
    Q("文中沒有提到哪一種小吃？", ["烤魷魚", "蚵仔煎", "臭豆腐"], "Which snack is NOT mentioned?", ["Grilled squid", "Oyster omelets", "Stinky tofu"], 2),
  ],
  "en-r-sleep": [
    Q("很多學生以為熬夜後可以怎麼補？", ["週末補眠", "多喝咖啡", "上課睡覺"], "How do many students think they can catch up on sleep?", ["Sleep more on weekends", "Drink more coffee", "Sleep in class"], 0),
    Q("科學家對這個習慣怎麼看？", ["弊大於利", "很健康", "沒有影響"], "What do scientists say about this habit?", ["It does more harm than good", "It is healthy", "It has no effect"], 0),
  ],
  "en-r-bubble-tea": [
    Q("珍奶大約在什麼時候發明？", ["1960 年代", "1980 年代", "2000 年代"], "When was bubble tea invented?", ["In the 1960s", "In the 1980s", "In the 2000s"], 1),
    Q("珍珠在杯子的哪裡？", ["上面", "中間", "底部"], "Where are the tapioca balls?", ["On top", "In the middle", "At the bottom"], 2),
  ],
  "en-r-recycling": [
    Q("觀光客常對什麼感到驚訝？", ["街上每晚播古典音樂", "垃圾很多", "沒有垃圾車"], "What often surprises visitors?", ["Classical music in the streets every evening", "Lots of trash", "No garbage trucks"], 0),
    Q("紙、塑膠和瓶子放到哪裡？", ["一般垃圾車", "另一台資源回收車", "路邊"], "Where do paper, plastic and bottles go?", ["The regular garbage truck", "A separate recycling truck", "The sidewalk"], 1),
  ],
  "en-r-volunteer": [
    Q("姊姊多久去一次收容所？", ["每週六", "每天", "每個月一次"], "How often does the sister volunteer?", ["Every Saturday", "Every day", "Once a month"], 0),
    Q("她一開始覺得工作怎樣？", ["很累又有點臭", "很輕鬆", "很無聊"], "How did she find the work at first?", ["Tiring and a little smelly", "Easy", "Boring"], 0),
  ],
  "en-r-smartphone-photos": [
    Q("文中拿現代人和誰比較拍照數量？", ["祖父母", "朋友", "攝影師"], "Who are people today compared with?", ["Their grandparents", "Their friends", "Photographers"], 0),
    Q("為什麼拍照可能讓我們記不清楚？", ["依賴相機而沒專心", "照片太多看不完", "手機太貴"], "Why might photos make us remember less clearly?", ["We rely on the camera instead of paying attention", "There are too many photos", "Phones are expensive"], 0),
  ],
  "en-c-tipping": [
    Q("在台灣，很多餐廳在帳單上加什麼？", ["10% 服務費", "20% 小費", "稅金 50%"], "What do many restaurants in Taiwan add to the bill?", ["A 10 percent service charge", "A 20 percent tip", "A 50 percent tax"], 0),
    Q("文中說除了餐廳，還常給誰小費？", ["計程車司機、美髮師、飯店員工", "老師", "醫生"], "Who else commonly gets tips?", ["Taxi drivers, hairdressers and hotel staff", "Teachers", "Doctors"], 0),
  ],
  "en-c-thanksgiving": [
    Q("感恩節常見的食物是什麼？", ["烤火雞和南瓜派", "年糕和魚", "粽子"], "What food is common at Thanksgiving?", ["Roast turkey and pumpkin pie", "Rice cake and fish", "Rice dumplings"], 0),
    Q("文中把感恩節比作台灣的什麼？", ["除夕團圓飯", "中秋烤肉", "端午節"], "What is Thanksgiving compared to in Taiwan?", ["The Lunar New Year's Eve reunion dinner", "Moon Festival barbecue", "Dragon Boat Festival"], 0),
  ],
  // ── 英文 L4 ──
  "en-r-remote-work": [
    Q("批評者說遠距工作會模糊什麼？", ["工作與生活的界線", "薪水高低", "上下班時間"], "What can remote work blur, according to critics?", ["The line between work and personal life", "Pay levels", "Commuting times"], 0),
    Q("混合模式通常要員工每週進公司幾天？", ["一天", "兩到三天", "五天"], "How many days a week does the hybrid model ask staff to come in?", ["One", "Two or three", "Five"], 1),
  ],
  "en-r-community-garden": [Q("Mrs. Chen 以前是做什麼的？", ["退休的自然老師", "大樓管理員", "農夫"], "What was Mrs. Chen's job?", ["A retired science teacher", "The building manager", "A farmer"], 0)],
  "en-r-phone-free-school": [Q("學校在哪裡？", ["台中", "台北", "高雄"], "Where is the school?", ["Taichung", "Taipei", "Kaohsiung"], 0)],
  "en-r-four-day-week": [Q("四天工作週每週大約工作幾小時？", ["二十小時", "三十二小時", "四十小時"], "About how many hours a week is a four-day week?", ["Twenty", "Thirty-two", "Forty"], 1)],
  "en-r-plastic-ocean": [Q("文中說禁用一次性吸管和袋子是什麼？", ["有用的第一步", "唯一的解法", "沒有用"], "How does the text describe banning single-use straws and bags?", ["A useful first step", "The only solution", "Useless"], 0)],
  "en-r-reading-habits": [Q("人們在螢幕上閱讀常會怎樣？", ["略讀、跳著找關鍵字", "讀得比較慢", "記得比較多"], "How do people tend to read on screens?", ["They skim, jumping to key words", "They read more slowly", "They remember more"], 0)],
  "en-c-small-talk": [
    Q("台灣親戚問私人問題，通常是什麼用意？", ["表示關心", "想吵架", "想借錢"], "What do Taiwanese relatives usually mean by personal questions?", ["They show care", "They want to argue", "They want to borrow money"], 0),
    Q("對方提到家人或工作時，可以怎麼做？", ["接著問相關問題", "馬上換話題", "問他薪水"], "What can you do if they mention their family or job?", ["Ask a follow-up question", "Change the subject at once", "Ask about salary"], 0),
  ],
  "en-c-saying-no": [
    Q("在台灣，「我再想想」常被理解成什麼？", ["委婉的拒絕", "一定答應", "生氣"], "How is \"I'll think about it\" often understood in Taiwan?", ["A polite refusal", "A definite yes", "Anger"], 0),
    Q("作者建議不確定時怎麼拒絕？", ["簡短理由加上謝謝", "不回答", "說謊"], "What does the writer suggest when in doubt?", ["A short reason and a thank-you", "Say nothing", "Make up a story"], 0),
  ],
  // ── 英文 L5–L6 ──
  "en-r-loneliness": [Q("心理學家怎麼定義孤獨？", ["擁有的關係和想要的關係之間的落差", "一個人獨處", "朋友很少"], "How do psychologists define loneliness?", ["The gap between the relationships we have and want", "Being alone", "Having few friends"], 0)],
  "en-r-ai-homework": [Q("為什麼偵測 AI 寫的作業很難？", ["偵測軟體會誤判", "老師不會用電腦", "學生不用 AI"], "Why is detecting AI-written work hard?", ["Detection software gives false alarms", "Teachers can't use computers", "Students don't use AI"], 0)],
  "en-r-tourism": [Q("旅遊作家鼓勵遊客怎麼做？", ["淡季來、待久一點、去在地小店", "只去最有名的景點", "搭郵輪一日遊"], "What do travel writers encourage visitors to do?", ["Come off-peak, stay longer, use local shops", "Visit only famous sights", "Take cruise day trips"], 0)],
  "en-r-failure": [Q("有些老師讓學生做什麼，讓失敗不那麼可怕？", ["看完回饋後重交作業", "不打分數", "不寫作業"], "What do some teachers allow so failure is less frightening?", ["Resubmitting after feedback", "No grades at all", "No homework"], 0)],
  "en-r-small-talk": [Q("閒聊對學外語的人有什麼好消息？", ["模式很好預測", "完全不用學", "只要背單字"], "What is the good news about small talk for learners?", ["It is highly predictable", "It needs no study", "Only vocabulary matters"], 0)],
  "en-r-memory-palace": [Q("老師建議初學者怎麼開始？", ["用家裡的路線記購物清單", "背整本字典", "記一場演講"], "How do teachers suggest beginners start?", ["Use a route at home to memorize a shopping list", "Memorize a dictionary", "Memorize a whole speech"], 0)],
  "en-r-slow-travel": [Q("文中說孩子在慢旅行中可以做什麼？", ["在遊樂場交朋友", "每天逛博物館", "搭很多次飛機"], "What can children do on a slow trip?", ["Make friends at the playground", "Visit museums every day", "Take many flights"], 0)],
  "en-r-translation": [Q("作者把機器翻譯比作什麼？", ["字典", "老師", "朋友"], "What does the writer compare machine translation to?", ["A dictionary", "A teacher", "A friend"], 0)],
  "en-r-urban-heat": [Q("鄰里志工在熱浪時做什麼？", ["探望年長鄰居", "發冷氣機", "種大樹"], "What do neighborhood volunteers do during heatwaves?", ["Check on elderly neighbors", "Hand out air conditioners", "Plant big trees"], 0)],
  "en-c-disagree": [Q("文中說荷蘭和德國人常被形容成怎樣？", ["更直接", "更含蓄", "很少說話"], "How are people in the Netherlands and Germany often described?", ["Even more direct", "More indirect", "Quiet"], 0)],

  // ── 日文 L0 ──
  "ja-r-neko": [Q("貓有幾隻？", ["一隻", "兩隻", "三隻"], "ねこは なんびき いますか。", ["いっぴき", "にひき", "さんびき"], 0)],
  "ja-r-asa": [Q("一開始說了什麼問候語？", ["おはよう", "こんばんは", "おやすみ"], "はじめに なんと いいましたか。", ["おはよう", "こんばんは", "おやすみ"], 0)],
  "ja-r-sora": [Q("今天天氣好嗎？", ["很好", "不好", "下雨"], "きょうは いい てんき ですか。", ["はい、いい てんき です", "いいえ", "あめ です"], 0)],
  "ja-r-kazoku": [Q("家裡有幾個人？", ["三個人", "四個人", "五個人"], "かぞくは なんにん ですか。", ["さんにん", "よにん", "ごにん"], 1)],
  "ja-c-itadakimasu": [Q("這是哪個國家的習慣？", ["日本", "美國", "英國"], "どこの しゅうかん ですか。", ["にほん", "アメリカ", "イギリス"], 0)],
  // ── 日文 L1 ──
  "ja-r-jikoshoukai": [Q("他喜歡什麼動物？", ["狗", "貓", "鳥"], "なにが すきですか。", ["いぬ", "ねこ", "とり"], 1)],
  "ja-r-ramen": [Q("他們去了哪裡？", ["拉麵店", "壽司店", "咖啡店"], "どこに いきましたか。", ["ラーメンや", "すしや", "きっさてん"], 0)],
  "ja-r-gakkou": [Q("在學校學什麼？", ["英文和日文", "數學", "音樂"], "がっこうで なにを べんきょうしますか。", ["えいごと にほんご", "すうがく", "おんがく"], 0)],
  "ja-r-kaimono": [Q("蘋果一個多少錢？", ["一百圓", "三百圓", "五十圓"], "りんごは ひとつ いくら でしたか。", ["ひゃくえん", "さんびゃくえん", "ごじゅうえん"], 0)],
  "ja-r-yasumi": [Q("早上幾點起床？", ["很早", "很晚", "沒有說"], "あさは いつ おきますか。", ["はやく", "おそく", "かいて いない"], 1)],
  "ja-r-densha": [Q("電車快嗎？", ["很快", "很慢", "沒有說"], "でんしゃは はやいですか。", ["はやい", "おそい", "かいて いない"], 0)],
  "ja-c-gomi": [Q("為什麼要守規則？", ["為了附近的鄰居", "為了拿錢", "因為好玩"], "どうして ルールを 守りますか。", ["近所の 人の ため", "お金を もらう ため", "たのしい から"], 0)],
  "ja-c-densha": [Q("優先席是給誰的？", ["老人和身體不方便的人", "學生", "上班族"], "優先席は だれの ためですか。", ["お年寄りや 体の 不自由な 人", "学生", "会社員"], 0)],
  // ── 日文 L2 ──
  "ja-r-tenki-yohou": [
    Q("明天下午會怎樣？", ["風會變強", "會下雪", "會放晴"], "明日の午後は どうなりますか。", ["風が強くなる", "雪が降る", "晴れる"], 0),
    Q("後天的溫度會怎樣？", ["有點熱", "很冷", "沒變"], "あさっての気温は どうですか。", ["少し暑くなる", "とても寒い", "変わらない"], 0),
  ],
  "ja-r-tomodachi-uchi": [
    Q("咖哩是誰做的？", ["田中同學", "田中的媽媽", "我"], "カレーは だれが作りましたか。", ["田中さん", "田中さんのお母さん", "私"], 1),
    Q("我請對方教我什麼？", ["咖哩的做法", "日文", "遊戲"], "何を教えてもらいましたか。", ["カレーの作り方", "日本語", "ゲーム"], 0),
  ],
  "ja-r-byouin": [
    Q("什麼時候開始不舒服？", ["昨天晚上", "今天早上", "上週"], "いつから具合が悪いですか。", ["きのうの夜", "今朝", "先週"], 0),
    Q("醫生說要怎麼做？", ["吃藥好好休息", "去上班", "去運動"], "お医者さんは何と言いましたか。", ["薬を飲んで休む", "会社へ行く", "運動する"], 0),
  ],
  "ja-r-hobby": [
    Q("週末常去哪裡？", ["山和海", "百貨公司", "圖書館"], "週末はよくどこへ出かけますか。", ["山や海", "デパート", "図書館"], 0),
    Q("喜歡在什麼時候拍山上的景色？", ["一大早", "中午", "晚上"], "いつ山の上から写真をとるのが好きですか。", ["朝早く", "昼", "夜"], 0),
  ],
  "ja-r-michi": [
    Q("轉彎後左邊有什麼？", ["大銀行", "公園", "學校"], "まがると左に何がありますか。", ["大きい銀行", "公園", "学校"], 0),
    Q("走路大約要幾分鐘？", ["五分鐘", "十分鐘", "二十分鐘"], "歩いて何分ぐらいですか。", ["五分", "十分", "二十分"], 0),
  ],
  "ja-r-ryokou-yotei": [
    Q("和誰去旅行？", ["家人", "朋友", "同事"], "だれと旅行に行きますか。", ["家族", "友だち", "同僚"], 0),
    Q("京都什麼季節的紅葉很漂亮？", ["春", "夏", "秋"], "京都は何の季節の紅葉がきれいですか。", ["春", "夏", "秋"], 2),
  ],
  "ja-c-oshogatsu": [
    Q("新年時很多人去哪裡？", ["神社初詣", "海邊", "百貨公司"], "お正月に どこへ 行きますか。", ["神社へ 初詣", "海", "デパート"], 0),
    Q("年底要做什麼？", ["大掃除", "去旅行", "買新車"], "年末には 何を しますか。", ["大そうじ", "旅行", "車を 買う"], 0),
  ],
  // ── 日文 L3 ──
  "ja-r-konbini": [
    Q("這篇文章主要在說什麼？", ["日本便利商店的多種功能和問題", "便利商店的歷史", "怎麼打工"], "この文章は主に何について書いてありますか。", ["コンビニの役割と課題", "コンビニの歴史", "アルバイトの方法"], 0),
    Q("為了 24 小時營業，遇到什麼問題？", ["人手不足", "沒有商品", "電費太貴"], "二十四時間営業の問題は何ですか。", ["人手不足", "商品がない", "電気代が高い"], 0),
  ],
  "ja-r-hanami": [
    Q("賞花通常和誰一起？", ["同事和朋友", "只有自己", "老師"], "お花見はだれとしますか。", ["同僚や友人", "一人で", "先生と"], 0),
    Q("櫻花大約開多久？", ["一週", "一個月", "三天"], "桜が咲いている期間はどのぐらいですか。", ["一週間ほど", "一か月", "三日"], 0),
  ],
  "ja-r-gomi": [
    Q("什麼也是依種類決定的？", ["可以丟的星期幾", "垃圾袋價格", "垃圾車顏色"], "種類ごとに何が決まっていますか。", ["出してもいい曜日", "ゴミ袋の値段", "ゴミ収集車の色"], 0),
    Q("作者一開始覺得怎樣？", ["很麻煩", "很簡單", "很有趣"], "筆者は最初どう思いましたか。", ["面倒だ", "簡単だ", "面白い"], 0),
  ],
  "ja-r-onsen": [
    Q("泡溫泉一般穿泳衣嗎？", ["一般不穿", "一定要穿", "隨便"], "温泉で水着を着ますか。", ["着ないのが一般的", "必ず着る", "どちらでもいい"], 0),
    Q("知道規則有什麼好處？", ["可以安心享受", "比較便宜", "可以帶毛巾進去"], "ルールを知っておくとどうなりますか。", ["安心して楽しめる", "安くなる", "タオルを入れられる"], 0),
  ],
  "ja-r-baito": [
    Q("哥哥在哪裡打工？", ["車站前的咖啡店", "超市", "便利商店"], "兄はどこでアルバイトをしていますか。", ["駅前のカフェ", "スーパー", "コンビニ"], 0),
    Q("哥哥現在是什麼角色？", ["教新人工作", "店長", "客人"], "兄は今どんな立場ですか。", ["新人に仕事を教える", "店長", "客"], 0),
  ],
  "ja-r-anime-nihongo": [
    Q("喜歡的作品看很多次會怎樣？", ["不會膩", "會膩", "會忘記"], "好きな作品は何度見るとどうですか。", ["飽きない", "飽きる", "忘れる"], 0),
    Q("說話時建議參考什麼？", ["日劇和新聞", "只有動畫", "漫畫"], "話すときは何を参考にするといいですか。", ["ドラマやニュース", "アニメだけ", "まんが"], 0),
  ],
  // ── 日文 L4 ──
  "ja-r-remote-work": [Q("什麼讓遠距工作在日本快速普及？", ["傳染病流行", "公司搬家", "政府規定"], "何をきっかけにリモートワークが広がりましたか。", ["感染症の流行", "会社の引っ越し", "政府の命令"], 0)],
  "ja-r-akiya": [Q("全國空屋大約有多少戶？", ["將近九百萬戶", "九萬戶", "九千戶"], "空き家は全国でどのぐらいありますか。", ["九百万戸近く", "九万戸", "九千戸"], 0)],
  "ja-r-keigo": [Q("學敬語的外國人覺得它是什麼？", ["一道大牆", "很簡單", "沒必要"], "敬語は外国人にとって何ですか。", ["大きな壁の一つ", "簡単なもの", "必要ないもの"], 0)],
};
