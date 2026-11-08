-- 補強：家人不能自己改角色；練習分鐘用原子累加，網站與 App 同時寫也不會蓋掉。

create or replace function guard_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not is_admin() then
    raise exception '只有管理者能改角色';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on profiles
  for each row execute function guard_profile_role();

create or replace function add_minutes(p_learner uuid, p_date date, p_minutes numeric)
returns void
language sql security invoker set search_path = public as $$
  insert into daily_logs (learner_id, date, minutes)
  values (p_learner, p_date, p_minutes)
  on conflict (learner_id, date) do update set minutes = daily_logs.minutes + excluded.minutes;
$$;

-- 明確授權：即使建專案時取消「Automatically expose new tables」也能用。
-- 只給登入的家人（authenticated），未登入（anon）什麼都碰不到；實際能看到哪幾列仍由上面的 RLS 決定。
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  profiles, language_progress, cards, attempts, assessments, daily_logs,
  rewards, prizes, redemptions, recordings, resources
  to authenticated;
grant select on ai_keys, ai_settings, ai_usage to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function is_admin() to authenticated;
grant execute on function add_minutes(uuid, date, numeric) to authenticated;
