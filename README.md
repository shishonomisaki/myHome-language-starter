# 全家說外語（自己架一份）

全家一起學英語、日語、西語的網站：分級測驗、每日練習清單、單字卡、文法與聽力練習、跟讀與 AI 口說評分、閱讀、作業錄音、家庭看板、多家庭後台。

這是**範本**：裡面沒有任何人的帳號、金鑰或資料庫。你要用**自己的** Supabase、Vercel、Gemini 金鑰，全部免費方案就能跑。

> 有用 AI 助理（Claude Code、Codex、Cursor 等）幫忙的話，先讓它讀 [`AGENTS.md`](AGENTS.md)。

## 你需要準備
- GitHub 帳號（按右上角 **Use this template** 複製一份到自己帳號）
- Supabase 帳號（資料庫與登入，免費）
- Vercel 帳號（放網站，免費 Hobby 方案；Hobby 不可商用）
- Google 帳號，到 https://aistudio.google.com 申請 Gemini API 金鑰（免費，口說評分用）

## 安裝步驟

### 1. 建 Supabase 專案
1. https://supabase.com → New project，區域建議 Northeast Asia (Tokyo)。
2. 左側 **SQL Editor**，依序把 `supabase/install/step1.sql` 到 `step5.sql` 各自整份貼上按 Run。
   每一步最後會顯示「步驟 N 完成」；**一定要一步一步跑**（第 2、4 步新增選項，要單獨完成）。
3. **Authentication → Sign In / Providers**：關閉「Allow new users to sign up」（家人帳號只從後台建）。

### 2. 建第一個管理者
1. **Authentication → Users → Add user**：Email 填 `帳號名稱@myhome.family`（這是假網域，不會寄信），設密碼，勾 Auto Confirm。
2. 打開 `supabase/scripts/create_first_admin.sql`，改 ① ② ③，貼到 SQL Editor 執行。

### 3. 加 Gemini 金鑰
打開 `supabase/scripts/add_gemini_key.sql`，照註解改 4 個地方後執行。金鑰只存在你的 Supabase Vault，不會進程式碼。
沒有金鑰網站也能用，只是口說改用瀏覽器「簡易評分」。

### 4. 部署到 Vercel
1. https://vercel.com → Add New → Project → 匯入你剛複製的 repo。
2. 填環境變數（Supabase → Project Settings → API 找得到）：
   | 名稱 | 內容 |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key（**只放 Vercel，不要貼到任何地方**） |
   | `CRON_SECRET` | 自己打一串 32 個字以上的亂碼（排程用） |
3. Deploy。`vercel.json` 裡的排程（每日預產練習、看板統計）會自動生效。
4. 用第 2 步的帳號名稱登入 → 後台新增家人。

## 一定要知道的事
- **Supabase 免費專案閒置約一週會自動暫停**，登入失敗時先到 Supabase 後台按 Restore。
- **Gemini 免費額度**有每分鐘／每日上限，家人多可以多加幾把（不同 Google 帳號）。未滿 18 歲使用的條款請自行評估。
- 錄音與照片不會存起來，只存評分結果。
- **範本不附文法／聽力題庫**（是空的）。單字、短文、五十音等內建教材有附。題庫要自己補，方法見下一節。

## 裝置與瀏覽器限制（原作者家實測）

下表只是原作者家實際測過的情況，不代表其他做法行不通；你有能力解決的限制（例如自己接麥克風），就不一定是限制。

各裝置功能相同（版面依螢幕寬度調整），差別在語音選擇、朗讀品質與收音。
| 裝置 / 瀏覽器 | 狀況 |
|---|---|
| **Windows 電腦 + Chrome / Edge** | **體驗最完整，最推薦。** 系統內建多種英／日語音可選（Edge 還有自然語音），朗讀示範最自然；麥克風收音穩定，口說評分結果最完整、最準。 |
| Android 手機、平板（Chrome 或三星瀏覽器） | 可用，指定語音有效（美國、英國、印度等口音聽得出不同，但差異比電腦小，要仔細聽）。手機麥克風與語音引擎較弱，評分與示範效果通常比 Windows 差一些。 |
| iPhone / iPad Safari | 沒實測。朗讀與錄音理論上可用，語音選擇、亮燈準度可能不同。 |
| Raspberry Pi 400（Chromium） | 原作者測試時**沒有接麥克風**（機器本身沒有內建），所以跟讀、口說評分、作業錄音沒辦法用；朗讀要另外裝語音引擎（例如 RHVoice）。如果你自己接上 USB 麥克風或耳麥並設定好，理論上就能用，只是原作者沒測過。 |
| 任何裝置 | 要用 HTTPS（Vercel 網址就是）麥克風才會開；第一次錄音要按「允許」。沒裝某語言的語音時，該語言朗讀會失敗或改用預設聲音，請到系統設定 → 文字轉語音 下載該語言。 |

朗讀亮燈（卡拉OK）的速度會依每台裝置自動校正，前幾句可能稍微對不準，唸幾句後就會跟上（原理見 `docs/speech-karaoke-sync.md`）。

## 題庫怎麼來：NotebookLM（原作者的做法）或你自己的 AI

文法、聽力分級練習要靠資料表 `item_bank` 的題目，範本裡是空的。有兩條路，**都由你自己決定規格**（`AGENTS.md` 有架構參考）。

### 路線 A：NotebookLM（nlm）— 原作者的設計
**為什麼用 nlm**
- **題目有出處、不亂編**：每本筆記本先放進可信的教材來源（考試官方範例、教科書、文法網站），出題只根據來源，比 AI 憑空出題少很多錯誤。
- **一份資料、多種教材**：同一本筆記本除了出題，還能做語音導覽（聽力素材）、閃卡、心智圖、學習指南。
- **記得每個人**：每人一本學習紀錄筆記本，把錯題、發音弱點、課本作業放進去，下次出題就會針對他。
- **事先產好，不讓人等**：都是空閒時批次產生、審過才上線，家人練習時不用等 AI。
- **省網站的 Gemini 額度**：出題不佔網站口說評分用的免費額度。

**原作者的做法**
1. 在自己電腦裝 NotebookLM 的 MCP 工具 `notebooklm-mcp-cli`（原作者的 repo：https://github.com/jacob-bd/gemini-notebook-mcp-cli ，PyPI：https://pypi.org/project/notebooklm-mcp-cli/ ；安裝方式以該 repo 說明為準，例如 `uv tool install notebooklm-mcp-cli`），用 `nlm login` 登入 Google，再接到 Claude 桌面版或其他 AI 助理。這是第三方非官方工具，跟本專案無關，使用前請自己看過它的說明與風險。
2. 每個語言開 1–2 本「分級題庫」筆記本（全家共用），每人一本「學習紀錄」筆記本。
3. 有人做完分級測驗，才產「目前級別 + 下一級」的題目；有人升級才開下一本。
4. 請 AI 向筆記本要 JSON 格式的題目 → 寫成 SQL 匯入 `item_bank`，`status = 'draft'`。
5. AI 先當老師審題，不確定的交給家裡程度最好的人；在後台「題庫審核」核准才會出給家人。
6. 每週批次：錯題補強、發音加強題、依興趣出讀物。

**注意**：nlm 不是網站功能，網站沒有串接它。它是非官方工具、要你自己的電腦開著、Google 登入常會過期、Pro 額度也不公開。
**不裝、不用，或設定方式跟原作者不同，網站基本功能一樣能用，但題庫不會自己長出新題、也沒有個人化加強題。這是使用方式不同造成的，不是網站的錯誤，原作者也無法支援。**

### 路線 B：不用 nlm，用你自己的 AI 出題（原作者沒用過，不保證）
1. 請你的 AI 助理讀 `AGENTS.md` 的「題目格式」，依你家的程度與目標出題（例如全民英檢初級文法 20 題）。
2. 請它產生一支 SQL：把題目寫進 `item_bank`，`status = 'draft'`，最後顯示新增筆數。
3. 到 Supabase SQL Editor 執行 → 網站後台「題庫審核」逐題看過、核准。

這條路**原作者沒有實際用過，不保證效果**，題目正確性要你自己把關（AI 憑空出題比較容易出錯，一定要審）。

## 本機開發
```bash
npm install
cp .env.example .env.local   # 填入上面的變數；不填就是瀏覽器試用模式
npm run dev
npm test
```

## 授權與責任
- 授權：[PolyForm Noncommercial 1.0.0](LICENSE.md)。可以免費使用、修改、分享給家人朋友，**不能拿來賣或做收費服務**；分享時要附上授權條款與 `Required Notice` 那一行。
- 照現況提供，沒有保證；你自己的帳號、金鑰、費用與資料由你自己負責。
