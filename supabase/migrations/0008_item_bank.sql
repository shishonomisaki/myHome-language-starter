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
