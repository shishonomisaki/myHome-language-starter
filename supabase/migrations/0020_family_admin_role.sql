-- 新角色：家庭管理員。要單獨執行完，再執行 0021。
alter type app_role add value if not exists 'family_admin';
