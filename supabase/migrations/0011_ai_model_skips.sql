-- 記下主要模型被跳過的次數和原因（例如 404 找不到模型、429 額度種類），
-- 給後台看為什麼這把金鑰改用備用模型。原因只有 Gemini 回的錯誤代碼與額度名稱，不含金鑰。
create table if not exists public.ai_model_skips (
  date date not null,
  key_id bigint not null references public.ai_keys(id) on delete cascade,
  model text not null,
  status smallint not null,
  count integer not null default 0,
  last_reason text,
  primary key (date, key_id, model, status)
);

alter table public.ai_model_skips enable row level security;
drop policy if exists "admin reads" on public.ai_model_skips;
create policy "admin reads" on public.ai_model_skips for select using (public.is_admin());
grant select on public.ai_model_skips to authenticated;

create or replace function public.ai_record_skip(p_key bigint, p_model text, p_status smallint, p_reason text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.ai_model_skips (date, key_id, model, status, count, last_reason)
  values ((now() at time zone 'utc')::date, p_key, p_model, p_status, 1, left(p_reason, 200))
  on conflict (date, key_id, model, status) do update
    set count = public.ai_model_skips.count + 1,
        last_reason = excluded.last_reason;
$$;

revoke execute on function public.ai_record_skip(bigint, text, smallint, text) from public, anon, authenticated;
grant execute on function public.ai_record_skip(bigint, text, smallint, text) to service_role;
