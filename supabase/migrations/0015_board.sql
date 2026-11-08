-- 首頁家庭看板：用家庭通關碼看，不用登入帳號。
-- 只有伺服器（service role）會讀這張表，一般登入者也讀不到通關碼。
create table if not exists family_settings (
  id int primary key default 1 check (id = 1),
  board_code text check (board_code is null or char_length(board_code) between 4 and 32),
  weekly_goal int not null default 300 check (weekly_goal between 10 and 5000)
);
insert into family_settings (id) values (1) on conflict (id) do nothing;

alter table family_settings enable row level security;
drop policy if exists "admin only" on family_settings;
create policy "admin only" on family_settings for all using (is_admin()) with check (is_admin());

-- 思考題亮點：家長核准後才會出現在看板上（顯示原文）。
alter table thoughts add column if not exists featured_at timestamptz;

-- 看板用：每人每天（台灣時間）的作答數與答對數。只給伺服器呼叫。
create or replace function board_attempt_days(since timestamptz)
returns table (learner_id uuid, day date, total int, correct int)
language sql stable security definer set search_path = public as $$
  select a.learner_id, (a.at at time zone 'Asia/Taipei')::date, count(*)::int, count(*) filter (where a.correct)::int
  from attempts a where a.at >= since group by 1, 2;
$$;
revoke execute on function board_attempt_days(timestamptz) from public, anon, authenticated;
grant execute on function board_attempt_days(timestamptz) to service_role;
