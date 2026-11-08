# 給 AI 助理的說明（AGENTS.md）

你正在協助一位使用者架設並客製自己的「全家說外語」。請用使用者的語言回覆（預設繁體中文）。

## 最重要的原則
1. **這是使用者自己的網站。** 程式裡的分級、題庫標準、筆記本規則都只是原作者家的做法，當作「參考架構」。
   遇到下列事情，**先問使用者想怎麼做，不要直接照搬**：
   - 家裡有誰、各自學哪些語言、每天幾分鐘、目標考試（全民英檢 / JLPT / DELE…）
   - 題庫的出題規格、難度、審題由誰負責
   - 要不要用 NotebookLM，筆記本怎麼分
   - 升級門檻、獎勵規則、看板要給誰看
2. **金鑰與密碼絕不寫進 repo、聊天紀錄或檔案。** Gemini 金鑰只放 Supabase Vault（`supabase/scripts/add_gemini_key.sql`），
   `SUPABASE_SERVICE_ROLE_KEY` 只放 Vercel 環境變數。請使用者自己貼，不要要求他把金鑰貼給你。
3. **誠實回報。** 沒在真網站／真手機上確認過，就說「還沒驗證」，請使用者自己試。
4. **給使用者的 SQL** 要能直接貼到 Supabase SQL Editor，最後一定要顯示一張結果表（新增/更新/略過幾筆），
   有沒改的佔位字就 `raise exception`。SQL Editor 遇到靜默略過不會有任何訊息。
5. **新增 enum 值**（`alter type ... add value`）要單獨一次執行，之後才能使用。

## 安裝流程（照 README）
Supabase 專案 → `supabase/install/step1~5.sql` 逐步執行 → 關閉公開註冊 → 建第一個使用者 →
`create_first_admin.sql` → `add_gemini_key.sql` → Vercel 匯入並設 4 個環境變數 → 部署 → 後台建家人。
之後新增的資料庫變更放 `supabase/migrations/NNNN_名稱.sql`，並告訴使用者要去 SQL Editor 執行。

## 程式架構速覽
- Next.js（App Router）+ Supabase（資料庫、登入、RLS）+ Vercel（網站、排程）。
- `src/lib/`：核心邏輯（間隔重複、分級、每日清單、升級、語音），有 vitest 測試。改完跑 `npm run lint && npm test && npm run build`。
- `src/content/`：內建教材（五十音、單字、短文）。`src/content/guide.ts`：首頁的使用說明與「最新更新」。
- `src/lib/gemini.ts`：AI 口說評分，模型清單 `GEMINI_MODELS`，遇 404/429/5xx 換下一個模型、再換下一把金鑰。
  Google 模型會更新下架，評分全部失敗時先檢查模型名稱。
- 登入帳號 = `帳號@myhome.family`（假網域，`src/lib/account.ts`），沒有寄信重設密碼，管理者在後台重設。
- 角色：`admin`（看全部家庭）、`family_admin`（只管自己家）、`learner`。
- 題庫表 `item_bank`：`status` = draft / approved，只有 approved 會出給家人；後台「題庫審核」可審。
- `docs/speech-karaoke-sync.md`：朗讀亮燈對位的原理，改朗讀相關功能前先讀；`docs/regression-checklist.md`：改版自查清單。

## NotebookLM（選用）— 參考架構，請使用者自己決定
網站**沒有**串接 NotebookLM。原作者的做法是在自己電腦上用 NotebookLM（透過 MCP 工具）產題，再用 SQL 匯入 `item_bank` 成草稿、審過才上線。
使用者不用、沒裝、或規則不同，網站基本功能照常；只是不會自動長出個人化新題，這不是 bug。

**如果使用者想用**，先跟他確認以下每一點，下面是原作者的選擇，只當例子：
| 要決定的事 | 原作者家的做法（參考） |
|---|---|
| 筆記本怎麼分 | 每個語言 1–2 本分級題庫筆記本（全家共用），加每人一本學習紀錄筆記本 |
| 何時產題 | 做過分級測驗後，只產「目前級別 + 下一級」；有人升級才開下一本 |
| 每次產題的提示 | 一定寫明「單一語言 + 級別」，產完檢查沒有混到別的語言 |
| 題目格式 | 回傳 JSON（選擇題 mcq / 句子 / 配對 pair）；配對要標詞性與例句；選項要洗牌 |
| 聽力題 | 英文聽力題幹與選項全英文；音檔單一說話者，題幹不要重複音檔內容 |
| 審題 | AI 先當資深老師審，不確定的交給家裡英文最好的人抽查；審過才 approved |
| 個人化 | 錯題補強、課本作業轉練習、發音弱點每週加強、依興趣出讀物 |
| 額度 | NotebookLM 沒有額度 API，要分批、自己記用量 |

## 題目格式（item_bank.content）
- `kind = 'mcq'`：`{"q": "題幹", "choices": ["A","B","C","D"], "answer": 0, "explain": "中文解說"}`（answer 是正確選項的索引；選項要洗牌）
- `kind = 'sentence'`：`{"text": "完整句子"}`（拼句、聽寫）
- `kind = 'pair'`：`{"term": "affect", "meaning": "影響（動詞）", "pos": "動", "example": "Rain affects my mood."}`
- 欄位：`language`（en/ja/es）、`area`（vocab/grammar/pattern/pronunciation/listening）、`level`（0–6）、`source`、`notebook`（可空）、`status`（先 draft）。
- 匯入 SQL 要 `on conflict`／`where not exists` 防重複，最後顯示新增筆數。
- 範本**不附題庫**。使用者沒有 NotebookLM 時，可以由你直接出題（路線 B），但一定要提醒：原作者沒用過這條路、不保證，題目要使用者審過才核准。

## 不要做的事
- 不要把任何人的帳號、金鑰、Supabase 專案網址寫進程式或文件。
- 不要沒問使用者就改分級門檻、評分標準或刪資料。
- 不要假設使用者有 NotebookLM。
