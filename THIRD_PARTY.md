# 第三方套件、服務與條款

每一項標示 來源／信心度（高／中／低）。條款會變，**部署前請自己看一次最新版**。本文件不是法律意見。

## 1. npm 套件（隨 `npm install` 下載，本 repo 不內附）
| 授權 | 數量（依 package-lock，2026-11-25） | 備註 |
|---|---|---|
| MIT / ISC / BSD / Apache-2.0 / BlueOak | 約 430 | 寬鬆授權，與本 repo 授權不衝突。高 |
| MPL-2.0 | 25 | 主要是 CSS 工具（lightningcss），只在建置時用。高 |
| LGPL-3.0-or-later | 只有 `sharp` 的 libvips 二進位檔 | Next.js 圖片處理用，動態連結、未修改。中 |
| GPL / AGPL | 無 | 高 |

重新產生清單：`npx license-checker --summary`。

## 2. 雲端服務（各自用自己的帳號，接受各家條款）
- **Google Gemini API**：用你自己的金鑰，受 Google API 條款與 Gemini API 附加條款約束。
  - ⚠️ 附加條款對未滿 18 歲使用者有限制；讓小孩用請自行評估。中（待確認最新文字）
  - ⚠️ 免費層的輸入輸出可能被 Google 用來改進產品、可能有人工審閱；不要送小孩的個資。網站只送練習文字與評分用語音內容，不存錄音。中（待確認）
  - 金鑰只放 Supabase Vault，由伺服器代呼叫，瀏覽器拿不到。高
- **Supabase、Vercel**：資料與費用由部署者負責。高
- **NotebookLM（選用）**：透過非官方工具 notebooklm-mcp-cli（作者自有授權，請看其 repo），用瀏覽器登入資料操作，**可能違反 Google 自動化存取條款、有帳號風險**，自行承擔；與 Google 無關。不要把 cookie 或登入檔放進 repo 或雲端。中

## 3. 語音與字型
- **朗讀聲音**：用作業系統／瀏覽器內建語音（Microsoft、Google、RHVoice 等），即時播放，不錄存、不散布音檔，因此不需附授權。部分語音（Edge 自然語音、Chrome 的 Google 語音）會把文字送到雲端合成。中
- RHVoice 本身為 LGPL，各語音另有授權；只有自己打包進映像檔才需注意。中
- **字型**：不內附字型檔，使用系統字型。高

## 4. 內建教材
- 單字、短文、五十音等內建教材由原作者整理或撰寫；五十音與單字本身不受著作權保護，短文為原創。中（待原作者逐一確認來源）
- 文法／聽力題庫不附。

## 5. 商標
Google、Gemini、NotebookLM、Microsoft、Supabase、Vercel 等為各公司商標，本專案與它們無關聯。
