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
