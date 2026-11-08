-- 全新安裝第 3 / 5 步：整份貼到 Supabase SQL Editor，按 Run。看到「步驟 3 完成」再做下一步。

-- ===== 0021_family_admin.sql =====
-- 多家庭第 2 階段：家庭管理員、親族圈、每家各自的看板通關碼、nlm 用量記錄。
-- 執行順序：0016 → 0017 → 0020 → 0021（0020 要單獨先跑完）。
-- 角色：admin = 超級管理員（看全部）；family_admin = 家庭管理員（只管自己家）；learner = 學習者。

-- 家庭：親族圈、看板通關碼、每週目標。
alter table households add column if not exists circle text not null default '親族';
alter table households add column if not exists board_code text unique
  check (board_code is null or char_length(board_code) between 4 and 32);
alter table households add column if not exists weekly_goal int not null default 300
  check (weekly_goal between 10 and 5000);

-- 把原本全站唯一的看板設定搬到第一個家庭。
update households h set board_code = f.board_code, weekly_goal = f.weekly_goal
from family_settings f
where f.id = 1 and h.id = '00000000-0000-0000-0000-000000000001' and h.board_code is null;

create or replace function is_family_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'family_admin');
$$;

-- 看得到這位學習者的資料嗎？本人、超級管理員、或同家庭的家庭管理員。
create or replace function can_see(learner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select learner = auth.uid()
    or exists (select 1 from profiles me where me.id = auth.uid() and me.role = 'admin')
    or exists (
      select 1 from profiles me join profiles p on p.household_id = me.household_id
      where me.id = auth.uid() and me.role = 'family_admin' and p.id = learner
    );
$$;
revoke execute on function is_family_admin() from public, anon;
revoke execute on function can_see(uuid) from public, anon;
grant execute on function is_family_admin() to authenticated;
grant execute on function can_see(uuid) to authenticated;

-- 個人資料表一律改成 can_see。
do $$
declare t text;
begin
  foreach t in array array['language_progress','cards','attempts','assessments','daily_logs',
                           'rewards','redemptions','recordings','done_tasks','thoughts'] loop
    execute format('drop policy if exists "own or admin" on %I', t);
    execute format('drop policy if exists "own or family admin" on %I', t);
    execute format('create policy "own or family admin" on %I for all using (can_see(learner_id)) with check (can_see(learner_id))', t);
  end loop;
end $$;

drop policy if exists "own or admin read" on class_homework;
drop policy if exists "own or admin mark practiced" on class_homework;
create policy "own or admin read" on class_homework for select using (can_see(learner_id));
create policy "own or admin mark practiced" on class_homework for update using (can_see(learner_id));

-- 家人資料：家庭管理員可以改自己家人的設定（不能改角色、不能改家庭，觸發器會擋）。
drop policy if exists "profiles: update self or admin" on profiles;
create policy "profiles: update self or admin" on profiles for update using (can_see(id));

-- nlm（NotebookLM）用量：Claude 每跑一次批次就記一筆，後台只給超級管理員看。
create table if not exists nlm_usage (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null check (kind in ('query', 'audio', 'quiz', 'source', 'other')),
  notebook text not null,
  count int not null default 1 check (count > 0),
  blocked boolean not null default false, -- Google 擋下時標記，之後用來校正上限
  note text
);
create index if not exists nlm_usage_at_idx on nlm_usage (at);
alter table nlm_usage enable row level security;
drop policy if exists "admin reads" on nlm_usage;
create policy "admin reads" on nlm_usage for select using (is_admin());

-- 每本筆記本目前的來源數（Claude 每天健康檢查時更新）。
create table if not exists nlm_notebooks (
  id text primary key,
  title text not null,
  sources int not null default 0,
  checked_at timestamptz not null default now()
);
alter table nlm_notebooks enable row level security;
drop policy if exists "admin reads" on nlm_notebooks;
create policy "admin reads" on nlm_notebooks for select using (is_admin());

-- 刪除家人時，他出過的測驗留著，只把「誰出的」清空。
alter table assessments drop constraint if exists assessments_assigned_by_fkey;
alter table assessments add constraint assessments_assigned_by_fkey
  foreign key (assigned_by) references profiles (id) on delete set null;


-- ===== 0022_fix_role_guard.sql =====
-- 修正：後台（伺服器）改角色時被「只有管理者能改角色」擋下。
-- 伺服器與 SQL Editor 沒有登入者，放行；後台 API 已先確認是超級管理員。
create or replace function guard_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not is_admin() then
    raise exception '只有管理者能改角色';
  end if;
  return new;
end;
$$;


-- ===== 0023_big_family.sql =====
-- 大家庭模式：打開後，任何一家的看板通關碼都看得到同一親族圈所有人的卡片。可隨時關掉。
alter table family_settings add column if not exists big_family boolean not null default false;


-- ===== 0023_fast_speech.sql =====
-- 後台可以替每位家人開放「快速朗讀」🐇：打開才會在朗讀語速多一段母語人士聊天的速度，預設關閉。
alter table public.profiles add column if not exists fast_speech boolean not null default false;


-- ===== 0024_pron_weak.sql =====
-- 發音弱點：跟讀時 AI 老師一再指出的字。同一個字被抓到 3 次以上才排進「加強發音」複習；
-- 之後連續 3 次唸這個字都沒被抓到就算改好了（cleared_at）。被抓到 10 次以上算「頑固」，會整理給 nlm 出加強題。
-- 寫入只走伺服器（service role）；本人和管理者讀得到。
create table if not exists pron_weak (
  learner_id uuid not null references profiles (id) on delete cascade,
  language text not null,
  word text not null,
  kind text not null default 'other',
  fix text not null default '',
  pair jsonb not null default '[]',
  misses int not null default 0,
  clean_streak int not null default 0,
  first_at timestamptz not null default now(),
  last_missed_at timestamptz not null default now(),
  cleared_at timestamptz,
  primary key (learner_id, language, word)
);
alter table pron_weak enable row level security;

drop policy if exists "own or admin read" on pron_weak;
create policy "own or admin read" on pron_weak for select
  using (learner_id = auth.uid() or is_admin());


select '步驟 3 完成' as 結果, 5 as 執行的檔案數, '0021_family_admin.sql, 0022_fix_role_guard.sql, 0023_big_family.sql, 0023_fast_speech.sql, 0024_pron_weak.sql' as 檔案;
