-- 看板統計快取：每天台灣時間 0 點、12 點由排程算好，打開看板只讀這裡。只有伺服器讀寫。
create table if not exists board_cache (
  household_id uuid primary key references households (id) on delete cascade,
  data jsonb not null,
  computed_at timestamptz not null default now()
);
alter table board_cache enable row level security;
