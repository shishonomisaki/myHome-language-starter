-- 全新安裝第 4 / 5 步：整份貼到 Supabase SQL Editor，按 Run。看到「步驟 4 完成」再做下一步。

-- ===== 0025_spanish.sql =====
-- 西班牙語：加入語言代碼 es，並預設只替第二位管理者打開。
alter type app_language add value if not exists 'es';


select '步驟 4 完成' as 結果, 1 as 執行的檔案數, '0025_spanish.sql' as 檔案;
