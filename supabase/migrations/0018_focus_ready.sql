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
