-- 全新安裝第 1 / 5 步：整份貼到 Supabase SQL Editor，按 Run。看到「步驟 1 完成」再做下一步。

-- ===== 0001_init.sql =====
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


-- ===== 0002_guards_and_rpc.sql =====
-- 補強：家人不能自己改角色；練習分鐘用原子累加，網站與 App 同時寫也不會蓋掉。

create or replace function guard_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not is_admin() then
    raise exception '只有管理者能改角色';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on profiles
  for each row execute function guard_profile_role();

create or replace function add_minutes(p_learner uuid, p_date date, p_minutes numeric)
returns void
language sql security invoker set search_path = public as $$
  insert into daily_logs (learner_id, date, minutes)
  values (p_learner, p_date, p_minutes)
  on conflict (learner_id, date) do update set minutes = daily_logs.minutes + excluded.minutes;
$$;

-- 明確授權：即使建專案時取消「Automatically expose new tables」也能用。
-- 只給登入的家人（authenticated），未登入（anon）什麼都碰不到；實際能看到哪幾列仍由上面的 RLS 決定。
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  profiles, language_progress, cards, attempts, assessments, daily_logs,
  rewards, prizes, redemptions, recordings, resources
  to authenticated;
grant select on ai_keys, ai_settings, ai_usage to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function is_admin() to authenticated;
grant execute on function add_minutes(uuid, date, numeric) to authenticated;


-- ===== 0003_revoke_definer_exec.sql =====
-- 收緊 SECURITY DEFINER 函式的執行權（Supabase 安全檢查建議）。
-- 已在正式資料庫套用（2026-10-21）。

revoke execute on function guard_profile_role() from public, anon, authenticated;
-- rls_auto_enable 是建專案時勾「Enable automatic RLS」才會有的函式，沒有就跳過。
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;
revoke execute on function is_admin() from public, anon;
grant execute on function is_admin() to authenticated;
revoke execute on function add_minutes(uuid, date, numeric) from public, anon;


-- ===== 0004_ai_keys.sql =====
-- Gemini 金鑰池：金鑰本身存在 Supabase Vault，這裡只記名稱與輪替設定。
-- 只有伺服器（service_role）能透過 ai_active_key() 拿到解密後的金鑰；家人登入的帳號拿不到。

create table if not exists public.ai_keys (
  id bigint generated by default as identity primary key,
  label text not null,
  cloud_project text not null,
  vault_secret_id uuid not null,
  rotation_order smallint not null,
  enabled boolean not null default true,
  last_error text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_settings (
  id boolean primary key default true check (id),
  rotation_days smallint not null default 7 check (rotation_days in (1, 7, 14)),
  active_key_id bigint references public.ai_keys(id),
  rotated_at timestamptz
);

create table if not exists public.ai_usage (
  key_id bigint not null references public.ai_keys(id) on delete cascade,
  date date not null,
  calls integer not null default 0,
  errors integer not null default 0,
  primary key (key_id, date)
);

alter table public.ai_keys enable row level security;
alter table public.ai_settings enable row level security;
alter table public.ai_usage enable row level security;

drop policy if exists "admin reads" on public.ai_keys;
drop policy if exists "admin reads" on public.ai_settings;
drop policy if exists "admin reads" on public.ai_usage;
create policy "admin reads" on public.ai_keys for select using (public.is_admin());
create policy "admin reads" on public.ai_settings for select using (public.is_admin());
create policy "admin reads" on public.ai_usage for select using (public.is_admin());
grant select on public.ai_keys, public.ai_settings, public.ai_usage to authenticated;

-- 今天這把金鑰（到了輪替天數就換下一把）。今天已用完額度就回傳空，呼叫端改用瀏覽器評分。
create or replace function public.ai_active_key()
returns table (key_id bigint, api_key text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.ai_settings;
  next_id bigint;
begin
  select * into s from public.ai_settings where id for update;
  if not found then return; end if;

  if s.active_key_id is null
     or s.rotated_at is null
     or s.rotated_at <= now() - make_interval(days => s.rotation_days) then
    select k.id into next_id
    from public.ai_keys k
    left join public.ai_keys cur on cur.id = s.active_key_id
    where k.enabled
    order by (k.rotation_order <= coalesce(cur.rotation_order, -1)), k.rotation_order
    limit 1;
    if next_id is not null then
      update public.ai_settings set active_key_id = next_id, rotated_at = now() where id;
      s.active_key_id := next_id;
    end if;
  end if;

  return query
  select k.id, d.decrypted_secret
  from public.ai_keys k
  join vault.decrypted_secrets d on d.id = k.vault_secret_id
  where k.id = s.active_key_id
    and k.enabled
    and coalesce(k.last_error, '') <> 'quota:' || (now() at time zone 'utc')::date;
end;
$$;

-- 記一次呼叫；quota = true 表示今天額度用完，今天其餘時間都改用瀏覽器評分。
create or replace function public.ai_record_usage(p_key bigint, p_ok boolean, p_quota boolean default false)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.ai_usage (key_id, date, calls, errors)
  values (p_key, (now() at time zone 'utc')::date, 1, case when p_ok then 0 else 1 end)
  on conflict (key_id, date) do update
    set calls = public.ai_usage.calls + 1,
        errors = public.ai_usage.errors + excluded.errors;
  update public.ai_keys
    set last_error = 'quota:' || (now() at time zone 'utc')::date
    where id = p_key and p_quota;
$$;

revoke execute on function public.ai_active_key() from public, anon, authenticated;
revoke execute on function public.ai_record_usage(bigint, boolean, boolean) from public, anon, authenticated;
grant execute on function public.ai_active_key() to service_role;
grant execute on function public.ai_record_usage(bigint, boolean, boolean) to service_role;


-- ===== 0005_class_homework.sql =====
-- 孩子的學校／安親班英文作業：每天錄一段，AI 整理成隔天的輔助練習。
-- 一人一天一筆，重錄會覆蓋。寫入只由伺服器（service_role）做，本人和管理者可讀。

create table if not exists public.class_homework (
  learner_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  language public.app_language not null default 'en',
  -- AI 整理結果：transcript、words、phrases、grammar、sentences、issues
  content jsonb not null,
  practiced_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (learner_id, date)
);

alter table public.class_homework enable row level security;
drop policy if exists "own or admin read" on public.class_homework;
drop policy if exists "own or admin mark practiced" on public.class_homework;
create policy "own or admin read" on public.class_homework for select
  using (learner_id = auth.uid() or public.is_admin());
create policy "own or admin mark practiced" on public.class_homework for update
  using (learner_id = auth.uid() or public.is_admin());
revoke all on public.class_homework from anon, authenticated;
grant select on public.class_homework to authenticated;
grant update (practiced_at) on public.class_homework to authenticated;


-- ===== 0006_homework_extended.sql =====
-- 作業延伸教材另外記完成時間：複習和延伸是兩項練習，各自做完各自打勾。
alter table public.class_homework add column if not exists extended_at timestamptz;
grant update (extended_at) on public.class_homework to authenticated;


-- ===== 0007_focus.sql =====
-- 管理者指定的強化項目：每人每語言可勾多項（字彙、文法、句型、發音、聽力），只有管理者能改。

alter table profiles add column if not exists focus jsonb not null default '{}';

create or replace function guard_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not is_admin() then
    raise exception '只有管理者能改角色';
  end if;
  if new.focus is distinct from old.focus and not is_admin() then
    raise exception '只有管理者能改強化項目';
  end if;
  return new;
end;
$$;


-- ===== 0008_item_bank.sql =====
-- 題庫：題型與練習題由 NotebookLM 產出，先存成草稿，管理者審過才給家人用。
-- kind：mcq（選擇題 {q, choices, answer, explain}）、sentence（拼句／聽寫短句 {text}）、pair（配對／字母重組 {term, meaning}）。

create table if not exists item_bank (
  id bigint generated always as identity primary key,
  language app_language not null,
  area text not null check (area in ('vocab', 'grammar', 'pattern', 'pronunciation', 'listening')),
  level smallint not null check (level between 0 and 6),
  kind text not null check (kind in ('mcq', 'sentence', 'pair')),
  content jsonb not null,
  source text not null default 'notebooklm',
  notebook text,
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists item_bank_pick on item_bank (language, area, status, level);

alter table item_bank enable row level security;
create policy "approved or admin read" on item_bank for select to authenticated using (status = 'approved' or is_admin());
create policy "admin review" on item_bank for update to authenticated using (is_admin()) with check (is_admin());

revoke all on item_bank from anon, authenticated;
grant select on item_bank to authenticated;
grant update (status, reviewed_at, content) on item_bank to authenticated;


-- ===== 0009_ai_model_usage.sql =====
-- 每天每個模型的呼叫次數，給後台確認 3.8 Flash 用完後有沒有換到 3.5 Flash-Lite。
create table if not exists public.ai_model_usage (
  date date not null,
  model text not null,
  calls integer not null default 0,
  errors integer not null default 0,
  primary key (date, model)
);

alter table public.ai_model_usage enable row level security;
drop policy if exists "admin reads" on public.ai_model_usage;
create policy "admin reads" on public.ai_model_usage for select using (public.is_admin());
grant select on public.ai_model_usage to authenticated;

-- 記一次呼叫，多記是哪個模型（最後一個嘗試的模型）。
drop function if exists public.ai_record_usage(bigint, boolean, boolean);
create or replace function public.ai_record_usage(p_key bigint, p_ok boolean, p_quota boolean default false, p_model text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.ai_usage (key_id, date, calls, errors)
  values (p_key, (now() at time zone 'utc')::date, 1, case when p_ok then 0 else 1 end)
  on conflict (key_id, date) do update
    set calls = public.ai_usage.calls + 1,
        errors = public.ai_usage.errors + excluded.errors;
  insert into public.ai_model_usage (date, model, calls, errors)
  select (now() at time zone 'utc')::date, p_model, 1, case when p_ok then 0 else 1 end
  where p_model is not null
  on conflict (date, model) do update
    set calls = public.ai_model_usage.calls + 1,
        errors = public.ai_model_usage.errors + excluded.errors;
  update public.ai_keys
    set last_error = 'quota:' || (now() at time zone 'utc')::date
    where id = p_key and p_quota;
$$;

revoke execute on function public.ai_record_usage(bigint, boolean, boolean, text) from public, anon, authenticated;
grant execute on function public.ai_record_usage(bigint, boolean, boolean, text) to service_role;


-- ===== 0010_ai_key_spread.sql =====
-- 金鑰分流：輪到的金鑰忙線（每分鐘次數滿）或今天額度用完時，同一次呼叫改用下一把，
-- 讓幾個人同時用 AI 時不會全部卡在同一把。另外讓管理者在後台改輪換天數、立刻換下一把。

-- 輪換天數多一個「每 3 天」。
alter table public.ai_settings drop constraint if exists ai_settings_rotation_days_check;
alter table public.ai_settings add constraint ai_settings_rotation_days_check check (rotation_days in (1, 3, 7, 14));

-- 今天能用的金鑰，輪到的那把排第一，其餘照輪換順序接在後面（繞一圈）。
create or replace function public.ai_usable_keys()
returns table (key_id bigint, api_key text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  cur_order smallint;
begin
  -- 先照排程輪換（到期就換下一把）。
  perform * from public.ai_active_key();
  select k.rotation_order into cur_order
  from public.ai_settings s
  join public.ai_keys k on k.id = s.active_key_id
  where s.id;

  return query
  select k.id, d.decrypted_secret::text
  from public.ai_keys k
  join vault.decrypted_secrets d on d.id = k.vault_secret_id
  where k.enabled
    and coalesce(k.last_error, '') <> 'quota:' || (now() at time zone 'utc')::date
  order by (k.rotation_order < coalesce(cur_order, -1)), k.rotation_order;
end;
$$;

-- 管理者：改輪換天數。
create or replace function public.ai_set_rotation_days(p_days smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  update public.ai_settings set rotation_days = p_days where id;
end;
$$;

-- 管理者：立刻換成下一把啟用中的金鑰，並從現在重新計算輪換天數。
create or replace function public.ai_rotate_now()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_id bigint;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  select k.id into next_id
  from public.ai_keys k
  left join public.ai_settings s on s.id
  left join public.ai_keys cur on cur.id = s.active_key_id
  where k.enabled
    and k.id is distinct from s.active_key_id
  order by (k.rotation_order <= coalesce(cur.rotation_order, -1)), k.rotation_order
  limit 1;
  if next_id is not null then
    update public.ai_settings set active_key_id = next_id, rotated_at = now() where id;
  end if;
end;
$$;

revoke execute on function public.ai_usable_keys() from public, anon, authenticated;
grant execute on function public.ai_usable_keys() to service_role;
revoke execute on function public.ai_set_rotation_days(smallint) from public, anon;
revoke execute on function public.ai_rotate_now() from public, anon;
grant execute on function public.ai_set_rotation_days(smallint) to authenticated;
grant execute on function public.ai_rotate_now() to authenticated;


-- ===== 0011_ai_model_skips.sql =====
-- 記下主要模型被跳過的次數和原因（例如 404 找不到模型、429 額度種類），
-- 給後台看為什麼這把金鑰改用備用模型。原因只有 Gemini 回的錯誤代碼與額度名稱，不含金鑰。
create table if not exists public.ai_model_skips (
  date date not null,
  key_id bigint not null references public.ai_keys(id) on delete cascade,
  model text not null,
  status smallint not null,
  count integer not null default 0,
  last_reason text,
  primary key (date, key_id, model, status)
);

alter table public.ai_model_skips enable row level security;
drop policy if exists "admin reads" on public.ai_model_skips;
create policy "admin reads" on public.ai_model_skips for select using (public.is_admin());
grant select on public.ai_model_skips to authenticated;

create or replace function public.ai_record_skip(p_key bigint, p_model text, p_status smallint, p_reason text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.ai_model_skips (date, key_id, model, status, count, last_reason)
  values ((now() at time zone 'utc')::date, p_key, p_model, p_status, 1, left(p_reason, 200))
  on conflict (date, key_id, model, status) do update
    set count = public.ai_model_skips.count + 1,
        last_reason = excluded.last_reason;
$$;

revoke execute on function public.ai_record_skip(bigint, text, smallint, text) from public, anon, authenticated;
grant execute on function public.ai_record_skip(bigint, text, smallint, text) to service_role;


-- ===== 0012_homework_uploaded_by.sql =====
-- 家長代傳作業：孩子沒手機時，管理者（爸媽）可以用自己的帳號替孩子拍照錄音。
-- 記下是誰送的；寫入仍只由伺服器（service_role）做，伺服器會檢查代傳者必須是 admin。
alter table public.class_homework
  add column if not exists uploaded_by uuid references public.profiles (id) on delete set null;

-- 資料庫層再擋一次：uploaded_by 不是本人時，一定要是管理者。
create or replace function public.class_homework_check_uploader() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.uploaded_by is not null and new.uploaded_by <> new.learner_id
     and not exists (select 1 from public.profiles where id = new.uploaded_by and role = 'admin') then
    raise exception '只有管理者可以代傳作業';
  end if;
  return new;
end $$;
revoke all on function public.class_homework_check_uploader() from public, anon, authenticated;

drop trigger if exists class_homework_check_uploader on public.class_homework;
create trigger class_homework_check_uploader before insert or update on public.class_homework
  for each row execute function public.class_homework_check_uploader();


-- ===== 0013_done_tasks.sql =====
-- 每日練習完成紀錄：首頁打勾用，換裝置、家長登入都看得到。
create table if not exists done_tasks (
  learner_id uuid not null references profiles (id) on delete cascade,
  date date not null,
  task_key text not null,
  done_at timestamptz not null default now(),
  primary key (learner_id, date, task_key)
);

alter table done_tasks enable row level security;

drop policy if exists "own or admin" on done_tasks;
create policy "own or admin" on done_tasks for all
  using (learner_id = auth.uid() or is_admin()) with check (learner_id = auth.uid() or is_admin());


-- ===== 0014_thoughts.sql =====
-- 文化短文的思考題回答：不計分，本人與管理者（家長）看得到。
create table if not exists thoughts (
  learner_id uuid not null references profiles (id) on delete cascade,
  reading_id text not null,
  idx int not null,
  answer text not null check (char_length(answer) <= 2000),
  at timestamptz not null default now(),
  primary key (learner_id, reading_id, idx)
);

alter table thoughts enable row level security;

drop policy if exists "own or admin" on thoughts;
create policy "own or admin" on thoughts for all
  using (learner_id = auth.uid() or is_admin()) with check (learner_id = auth.uid() or is_admin());


-- ===== 0015_board.sql =====
-- 首頁家庭看板：用家庭通關碼看，不用登入帳號。
-- 只有伺服器（service role）會讀這張表，一般登入者也讀不到通關碼。
create table if not exists family_settings (
  id int primary key default 1 check (id = 1),
  board_code text check (board_code is null or char_length(board_code) between 4 and 32),
  weekly_goal int not null default 300 check (weekly_goal between 10 and 5000)
);
insert into family_settings (id) values (1) on conflict (id) do nothing;

alter table family_settings enable row level security;
drop policy if exists "admin only" on family_settings;
create policy "admin only" on family_settings for all using (is_admin()) with check (is_admin());

-- 思考題亮點：家長核准後才會出現在看板上（顯示原文）。
alter table thoughts add column if not exists featured_at timestamptz;

-- 看板用：每人每天（台灣時間）的作答數與答對數。只給伺服器呼叫。
create or replace function board_attempt_days(since timestamptz)
returns table (learner_id uuid, day date, total int, correct int)
language sql stable security definer set search_path = public as $$
  select a.learner_id, (a.at at time zone 'Asia/Taipei')::date, count(*)::int, count(*) filter (where a.correct)::int
  from attempts a where a.at >= since group by 1, 2;
$$;
revoke execute on function board_attempt_days(timestamptz) from public, anon, authenticated;
grant execute on function board_attempt_days(timestamptz) to service_role;


-- ===== 0016_households.sql =====
-- 多家庭第 1 階段：加入「家庭」概念，現有 4 人放進第一個家庭。畫面與使用方式不變。
create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  tag text check (tag is null or char_length(tag) <= 20), -- 超級管理員在後台看的標記
  created_at timestamptz not null default now()
);
alter table households enable row level security;

insert into households (id, name, tag)
values ('00000000-0000-0000-0000-000000000001', '我的家', '本家')
on conflict (id) do nothing;

alter table profiles add column if not exists household_id uuid
  not null default '00000000-0000-0000-0000-000000000001' references households (id);
create index if not exists profiles_household_idx on profiles (household_id);

-- 登入者所屬家庭（給 RLS 用）。
create or replace function my_household() returns uuid
language sql stable security definer set search_path = public as $$
  select household_id from profiles where id = auth.uid();
$$;
revoke execute on function my_household() from public, anon;
grant execute on function my_household() to authenticated;

-- 家庭只看得到自己家；超級管理員（現在的 admin）看全部。
drop policy if exists "households: own or admin" on households;
create policy "households: own or admin" on households for select
  using (id = my_household() or is_admin());
drop policy if exists "households: admin writes" on households;
create policy "households: admin writes" on households for all
  using (is_admin()) with check (is_admin());

-- 家人名單：以前所有登入者都看得到全部人，改成只看同家庭。
drop policy if exists "profiles: read family" on profiles;
create policy "profiles: read family" on profiles for select
  using (household_id = my_household() or is_admin());

-- 家庭欄位只有超級管理員能改。
create or replace function guard_profile_household() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- SQL Editor／伺服器直接操作時沒有登入者（auth.uid() 是空的），放行。
  if new.household_id is distinct from old.household_id and auth.uid() is not null
     and not is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'only admin can change household';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_guard_household on profiles;
create trigger profiles_guard_household before update on profiles
  for each row execute function guard_profile_household();


-- ===== 0016b_fix_household_guard.sql =====
-- 修正 0016：在 SQL Editor 直接改家庭時不要被擋。跑完再重跑 0017。
create or replace function guard_profile_household() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.household_id is distinct from old.household_id and auth.uid() is not null
     and not is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'only admin can change household';
  end if;
  return new;
end;
$$;


-- ===== 0018_focus_ready.sql =====
-- 強化單元預先出題：每人每語言每項目放一份「準備好的題目」，打開就能練。
-- served_on 是拿去練的那天（台灣日期）；同一天再打開拿同一份，隔天就換新的。
-- 只有伺服器（service role）會讀寫。
create table if not exists focus_ready (
  learner_id uuid not null references profiles(id) on delete cascade,
  language text not null,
  area text not null,
  drill jsonb not null,
  source text not null default 'ai',
  made_at timestamptz not null default now(),
  served_on date,
  primary key (learner_id, language, area)
);
alter table focus_ready enable row level security;


-- ===== 0019_essays.sql =====
-- 作文練習：本人寫的作文和 AI 批改結果（照片不存，只存辨識出的文字）。
-- 寫入只走伺服器（service role）；本人和管理者（家長）讀得到。
-- needs_review：兩次 AI 評分差超過 10 分，等 Claude 複評。
create table if not exists essays (
  id bigint generated always as identity primary key,
  learner_id uuid not null references profiles (id) on delete cascade,
  written_on date not null,
  language text not null default 'en',
  title text not null default '',
  body text not null check (char_length(body) <= 6000),
  score int not null,
  feedback jsonb not null,
  needs_review boolean not null default false,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists essays_learner_idx on essays (learner_id, written_on desc);

alter table essays enable row level security;

drop policy if exists "own or admin read" on essays;
create policy "own or admin read" on essays for select
  using (learner_id = auth.uid() or is_admin());


select '步驟 1 完成' as 結果, 19 as 執行的檔案數, '0001_init.sql, 0002_guards_and_rpc.sql, 0003_revoke_definer_exec.sql, 0004_ai_keys.sql, 0005_class_homework.sql, 0006_homework_extended.sql, 0007_focus.sql, 0008_item_bank.sql, 0009_ai_model_usage.sql, 0010_ai_key_spread.sql, 0011_ai_model_skips.sql, 0012_homework_uploaded_by.sql, 0013_done_tasks.sql, 0014_thoughts.sql, 0015_board.sql, 0016_households.sql, 0016b_fix_household_guard.sql, 0018_focus_ready.sql, 0019_essays.sql' as 檔案;
