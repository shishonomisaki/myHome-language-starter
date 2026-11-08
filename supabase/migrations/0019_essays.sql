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
