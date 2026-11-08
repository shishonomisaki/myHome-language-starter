-- 每天每個模型的呼叫次數，給後台確認 3.8 Flash 用完後有沒有換到 3.5 Flash-Lite。
create table if not exists public.ai_model_usage (
  date date not null,
  model text not null,
  calls integer not null default 0,
  errors integer not null default 0,
  primary key (date, model)
);

alter table public.ai_model_usage enable row level security;
drop policy if exists "admin reads" on public.ai_model_usage;
create policy "admin reads" on public.ai_model_usage for select using (public.is_admin());
grant select on public.ai_model_usage to authenticated;

-- 記一次呼叫，多記是哪個模型（最後一個嘗試的模型）。
drop function if exists public.ai_record_usage(bigint, boolean, boolean);
create or replace function public.ai_record_usage(p_key bigint, p_ok boolean, p_quota boolean default false, p_model text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.ai_usage (key_id, date, calls, errors)
  values (p_key, (now() at time zone 'utc')::date, 1, case when p_ok then 0 else 1 end)
  on conflict (key_id, date) do update
    set calls = public.ai_usage.calls + 1,
        errors = public.ai_usage.errors + excluded.errors;
  insert into public.ai_model_usage (date, model, calls, errors)
  select (now() at time zone 'utc')::date, p_model, 1, case when p_ok then 0 else 1 end
  where p_model is not null
  on conflict (date, model) do update
    set calls = public.ai_model_usage.calls + 1,
        errors = public.ai_model_usage.errors + excluded.errors;
  update public.ai_keys
    set last_error = 'quota:' || (now() at time zone 'utc')::date
    where id = p_key and p_quota;
$$;

revoke execute on function public.ai_record_usage(bigint, boolean, boolean, text) from public, anon, authenticated;
grant execute on function public.ai_record_usage(bigint, boolean, boolean, text) to service_role;
