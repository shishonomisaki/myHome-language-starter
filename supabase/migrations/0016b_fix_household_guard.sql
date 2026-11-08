-- 修正 0016：在 SQL Editor 直接改家庭時不要被擋。跑完再重跑 0017。
create or replace function guard_profile_household() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.household_id is distinct from old.household_id and auth.uid() is not null
     and not is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'only admin can change household';
  end if;
  return new;
end;
$$;
