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
