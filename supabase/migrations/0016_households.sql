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
