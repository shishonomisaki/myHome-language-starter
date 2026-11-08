-- 全新安裝第 5 / 5 步：整份貼到 Supabase SQL Editor，按 Run。看到「步驟 5 完成」再做下一步。

-- ===== 0027_board_cache.sql =====
-- 看板統計快取：每天台灣時間 0 點、12 點由排程算好，打開看板只讀這裡。只有伺服器讀寫。
create table if not exists board_cache (
  household_id uuid primary key references households (id) on delete cascade,
  data jsonb not null,
  computed_at timestamptz not null default now()
);
alter table board_cache enable row level security;


select '步驟 5 完成' as 結果, 1 as 執行的檔案數, '0027_board_cache.sql' as 檔案;
