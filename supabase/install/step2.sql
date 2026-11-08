-- 全新安裝第 2 / 5 步：整份貼到 Supabase SQL Editor，按 Run。看到「步驟 2 完成」再做下一步。

-- ===== 0020_family_admin_role.sql =====
-- 新角色：家庭管理員。要單獨執行完，再執行 0021。
alter type app_role add value if not exists 'family_admin';


select '步驟 2 完成' as 結果, 1 as 執行的檔案數, '0020_family_admin_role.sql' as 檔案;
