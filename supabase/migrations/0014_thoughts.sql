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
