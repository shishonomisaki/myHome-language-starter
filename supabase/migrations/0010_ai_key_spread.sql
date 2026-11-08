-- 金鑰分流：輪到的金鑰忙線（每分鐘次數滿）或今天額度用完時，同一次呼叫改用下一把，
-- 讓幾個人同時用 AI 時不會全部卡在同一把。另外讓管理者在後台改輪換天數、立刻換下一把。

-- 輪換天數多一個「每 3 天」。
alter table public.ai_settings drop constraint if exists ai_settings_rotation_days_check;
alter table public.ai_settings add constraint ai_settings_rotation_days_check check (rotation_days in (1, 3, 7, 14));

-- 今天能用的金鑰，輪到的那把排第一，其餘照輪換順序接在後面（繞一圈）。
create or replace function public.ai_usable_keys()
returns table (key_id bigint, api_key text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  cur_order smallint;
begin
  -- 先照排程輪換（到期就換下一把）。
  perform * from public.ai_active_key();
  select k.rotation_order into cur_order
  from public.ai_settings s
  join public.ai_keys k on k.id = s.active_key_id
  where s.id;

  return query
  select k.id, d.decrypted_secret::text
  from public.ai_keys k
  join vault.decrypted_secrets d on d.id = k.vault_secret_id
  where k.enabled
    and coalesce(k.last_error, '') <> 'quota:' || (now() at time zone 'utc')::date
  order by (k.rotation_order < coalesce(cur_order, -1)), k.rotation_order;
end;
$$;

-- 管理者：改輪換天數。
create or replace function public.ai_set_rotation_days(p_days smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  update public.ai_settings set rotation_days = p_days where id;
end;
$$;

-- 管理者：立刻換成下一把啟用中的金鑰，並從現在重新計算輪換天數。
create or replace function public.ai_rotate_now()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_id bigint;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  select k.id into next_id
  from public.ai_keys k
  left join public.ai_settings s on s.id
  left join public.ai_keys cur on cur.id = s.active_key_id
  where k.enabled
    and k.id is distinct from s.active_key_id
  order by (k.rotation_order <= coalesce(cur.rotation_order, -1)), k.rotation_order
  limit 1;
  if next_id is not null then
    update public.ai_settings set active_key_id = next_id, rotated_at = now() where id;
  end if;
end;
$$;

revoke execute on function public.ai_usable_keys() from public, anon, authenticated;
grant execute on function public.ai_usable_keys() to service_role;
revoke execute on function public.ai_set_rotation_days(smallint) from public, anon;
revoke execute on function public.ai_rotate_now() from public, anon;
grant execute on function public.ai_set_rotation_days(smallint) to authenticated;
grant execute on function public.ai_rotate_now() to authenticated;
