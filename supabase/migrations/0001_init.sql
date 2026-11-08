-- 全家多語化：初始資料庫結構（Supabase / PostgreSQL）
-- 每個人只看得到自己的資料；管理者看得到全家。

create type app_role as enum ('admin', 'learner');
create type app_language as enum ('en', 'ja');
create type app_skill as enum ('vocab', 'grammar', 'reading', 'listening', 'speaking');

-- 家人帳號（對應 Supabase Auth 使用者）。只存暱稱，不存真名。
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null,
  avatar text not null default '🙂',
  role app_role not null default 'learner',
  is_learning boolean not null default true,
  daily_minutes smallint not null default 15 check (daily_minutes in (15, 30, 45, 60)),
  -- 英日時間分配，例如 {"en": 2, "ja": 1}
  languages jsonb not null default '{"en": 1}',
  ai_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- 每人、每語言的五項技能級別（0–6）。
create table language_progress (
  learner_id uuid not null references profiles (id) on delete cascade,
  language app_language not null,
  levels jsonb not null default '{"vocab":0,"grammar":0,"reading":0,"listening":0,"speaking":0}',
  placement_done boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (learner_id, language)
);

-- 間隔重複卡片（錯題本也在這裡：lapses > 0 的就是錯過的）。
create table cards (
  learner_id uuid not null references profiles (id) on delete cascade,
  item_id text not null,
  streak smallint not null default 0,
  due date not null,
  lapses smallint not null default 0,
  last_reviewed date,
  primary key (learner_id, item_id)
);
create index cards_due on cards (learner_id, due);

-- 每次作答紀錄，用來畫趨勢與找弱點。
create table attempts (
  id bigint generated always as identity primary key,
  learner_id uuid not null references profiles (id) on delete cascade,
  item_id text not null,
  language app_language not null,
  skill app_skill not null,
  correct boolean not null,
  at timestamptz not null default now()
);
create index attempts_learner_at on attempts (learner_id, at desc);

-- 測驗紀錄：分級、單元小測、定期檢測、隨時測驗、模擬考。
create table assessments (
  id bigint generated always as identity primary key,
  learner_id uuid not null references profiles (id) on delete cascade,
  language app_language not null,
  kind text not null check (kind in ('placement', 'unit', 'periodic', 'adhoc', 'mock')),
  skill app_skill,
  result jsonb not null,
  assigned_by uuid references profiles (id),
  taken_at timestamptz not null default now()
);

-- 每日練習分鐘，用來算連續天數與累計時數。
create table daily_logs (
  learner_id uuid not null references profiles (id) on delete cascade,
  date date not null,
  minutes numeric(6, 2) not null default 0,
  primary key (learner_id, date)
);

-- 獎勵：點數、保護卡、徽章。
create table rewards (
  learner_id uuid primary key references profiles (id) on delete cascade,
  points integer not null default 0,
  freeze_cards smallint not null default 0,
  badges text[] not null default '{}',
  frozen_dates date[] not null default '{}'
);

-- 家庭獎品（爸媽在後台設定，用點數兌換）。
create table prizes (
  id bigint generated always as identity primary key,
  title text not null,
  cost integer not null check (cost > 0),
  active boolean not null default true
);
create table redemptions (
  id bigint generated always as identity primary key,
  learner_id uuid not null references profiles (id) on delete cascade,
  prize_id bigint not null references prizes (id),
  redeemed_at timestamptz not null default now()
);

-- 口說錄音：檔案放在 Storage 的 recordings 桶，只保留 30 天。
create table recordings (
  id bigint generated always as identity primary key,
  learner_id uuid not null references profiles (id) on delete cascade,
  language app_language not null,
  item_id text,
  storage_path text not null,
  asr_text text,
  ai_feedback text,
  reviewer_note text,
  created_at timestamptz not null default now()
);

-- 外部資源清單（後台可自行新增）。
create table resources (
  id bigint generated always as identity primary key,
  language app_language not null,
  name text not null,
  url text not null,
  min_level smallint not null,
  max_level smallint not null,
  skills app_skill[] not null,
  how text
);

-- Gemini 金鑰池：金鑰本身只存在 Supabase Vault，這裡只放參照。
-- 全站同一時間只用一把，依排程輪換；用到當日上限就改用瀏覽器評分。
create table ai_keys (
  id bigint generated always as identity primary key,
  label text not null,             -- 例如來源 Google 帳號
  cloud_project text not null,     -- 額度算在專案上，每把要來自不同專案
  vault_secret_id uuid not null,   -- vault.secrets 的 id
  rotation_order smallint not null,
  enabled boolean not null default true,
  last_error text,
  created_at timestamptz not null default now()
);
create table ai_settings (
  id boolean primary key default true check (id),
  rotation_days smallint not null default 7 check (rotation_days in (1, 7, 14)),
  active_key_id bigint references ai_keys (id),
  rotated_at timestamptz
);
create table ai_usage (
  key_id bigint not null references ai_keys (id) on delete cascade,
  date date not null,
  calls integer not null default 0,
  errors integer not null default 0,
  primary key (key_id, date)
);

-- 權限：自己的資料自己看，管理者看全部；金鑰相關只有伺服器端（service role）能碰。
alter table profiles enable row level security;
alter table language_progress enable row level security;
alter table cards enable row level security;
alter table attempts enable row level security;
alter table assessments enable row level security;
alter table daily_logs enable row level security;
alter table rewards enable row level security;
alter table prizes enable row level security;
alter table redemptions enable row level security;
alter table recordings enable row level security;
alter table resources enable row level security;
alter table ai_keys enable row level security;
alter table ai_settings enable row level security;
alter table ai_usage enable row level security;

create policy "profiles: read family" on profiles for select using (auth.uid() is not null);
create policy "profiles: update self or admin" on profiles for update using (id = auth.uid() or is_admin());
create policy "profiles: admin insert" on profiles for insert with check (is_admin());

create policy "own or admin" on language_progress for all
  using (learner_id = auth.uid() or is_admin()) with check (learner_id = auth.uid() or is_admin());
create policy "own or admin" on cards for all
  using (learner_id = auth.uid() or is_admin()) with check (learner_id = auth.uid() or is_admin());
create policy "own or admin" on attempts for all
  using (learner_id = auth.uid() or is_admin()) with check (learner_id = auth.uid() or is_admin());
create policy "own or admin" on assessments for all
  using (learner_id = auth.uid() or is_admin()) with check (learner_id = auth.uid() or is_admin());
create policy "own or admin" on daily_logs for all
  using (learner_id = auth.uid() or is_admin()) with check (learner_id = auth.uid() or is_admin());
create policy "own or admin" on rewards for all
  using (learner_id = auth.uid() or is_admin()) with check (learner_id = auth.uid() or is_admin());
create policy "own or admin" on redemptions for all
  using (learner_id = auth.uid() or is_admin()) with check (learner_id = auth.uid() or is_admin());
create policy "own or admin" on recordings for all
  using (learner_id = auth.uid() or is_admin()) with check (learner_id = auth.uid() or is_admin());

create policy "everyone reads" on prizes for select using (auth.uid() is not null);
create policy "admin writes" on prizes for all using (is_admin()) with check (is_admin());
create policy "everyone reads" on resources for select using (auth.uid() is not null);
create policy "admin writes" on resources for all using (is_admin()) with check (is_admin());

-- 管理者可以看用量與金鑰清單（不含金鑰本身）；寫入只走伺服器端。
create policy "admin reads" on ai_keys for select using (is_admin());
create policy "admin reads" on ai_settings for select using (is_admin());
create policy "admin reads" on ai_usage for select using (is_admin());
