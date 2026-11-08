# 朗讀亮燈（卡拉OK）對位與自動校正

程式在 `src/lib/speech.ts`，測試在 `src/lib/__tests__/speech-replay.test.ts`。
**亮燈跟聲音錯開時，先讀這份、跑測試，不要憑感覺反覆改參數。**

## 為什麼會錯開
Web Speech API 在不同瀏覽器／語音差很多：
- 有的語音每個字都回報 `boundary`（準），有的完全不回報，有的只回報一部分。
- Chrome 在 `cancel()` 後馬上 `speak()`（換速度、點別句）常常收不到 `onstart`。
- Android Chrome 與三星瀏覽器都會照網頁指定的聲音（2026-11-08 實測更正：口音差異較小、要仔細聽）。
- 慢速（0.4）時引擎實際速度不是照語速等比例變慢。

## 做法（三層，由準到不準）
1. **回報的字（boundary）最準**：收到就亮那個字，並當作新的錨點。
2. **沒回報時用時間估計**：`estimateAt(part, anchor, 經過時間, pace)`，pace＝每秒唸幾個「字元權重」（標點算停頓，`spokenLength`）。
3. **句尾的 `end` 是真相**：每句唸完用實際花的時間更新 pace（`savePace`），下一句就準。

## 自動校正（pace）
- 儲存：localStorage `speech-pace`，key＝`語音名稱@語速`。
- 預設：英文 14／日文 7 字元每秒 × 語速（`defaultPace`）。
- 這個語速沒量過：從同語音最接近的語速換算，`pace × (rate / 鄰近rate)^0.75`（不是 1 次方，慢速才不會估太慢）。
- 句尾更新（`savePace`）：新值佔 60%、舊值 40%；句子權重長度 ≥ 15 且 ≥ 500 ms 才算。**要有真的 onstart，或是排隊中第二句起（從上一句 end 算起）才學**，第一句靠猜的起點不學。
- 句中更新（`onboundary`）：已唸 ≥ 8 字元且 > 500 ms 時，用「到這個字花多久」算局部速度，與目前 pace 取平均，限制在 pace 的 ½～2 倍。

## 防亂跳
- 估計只往前走，不往回跳（`lit`）。
- 回報位置落後估計 ≤ 12 字元：維持目前亮的字；落後更多才退回對齊。
- 收過回報後，`resumeDelay`（約兩個字的時間，限 0.5～1.5 s）沒下一個回報才改用估計。
- 沒收到 onstart：第一個回報、上一句 end、或保底計時器（`START_FALLBACK_MS` 350 ms）任一個先到就開始計時；猜的起點往後挪 `GUESSED_START_LAG_MS` 250 ms。
- 打斷後重唸等 `CANCEL_GAP_MS` 120 ms。

## 🐇 快速
語速 > `WORD_LIGHT_MAX_RATE`（1.05）只標整句不逐字。語速：🐢 0.4、🚶 0.85、🐇 1.15（`src/lib/speech-speed.ts`）。

## 暫停／繼續
暫停記住亮到的那個字（`lastWordAt`），繼續從那個字接著唸（`speak(from)` 允許從句中開始，亮燈仍標整句）。不用 `speechSynthesis.pause()`，手機上常 resume 不回來。

## 點句子朗讀（全站共用 `SpeakText`）
`src/components/SpeakText.tsx`：把文字切成可點的句子（`speakableSegments`，`mixed` 時只挑外語片段），每句各自 `speak()` 並用 `Highlighted` 亮燈；同一句唸中再點＝`pauseSpeaking`，暫停中再點＝`resumeSpeaking`（從停住的字接著唸）。亮燈參數沿用上面的機制，不要在這裡另調。短文閱讀頁有「全文＋單句」三段點法，仍用自己的 `tapSpeech`。

## 改動前後必做
1. `npx vitest run`（含 `speech-replay.test.ts`：換速度亮燈不落後、量到的速度被採用、連續偏掉會校正）。
2. 新參數要寫回這份文件，並說明為什麼。
3. 回報時說明有沒有在真手機（Chrome／三星瀏覽器）實測；Playwright 假語音只能驗邏輯，不能驗聲音對位。
