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
