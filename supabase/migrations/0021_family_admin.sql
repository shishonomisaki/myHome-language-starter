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
