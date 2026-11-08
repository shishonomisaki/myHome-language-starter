-- 修正：後台（伺服器）改角色時被「只有管理者能改角色」擋下。
-- 伺服器與 SQL Editor 沒有登入者，放行；後台 API 已先確認是超級管理員。
create or replace function guard_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not is_admin() then
    raise exception '只有管理者能改角色';
  end if;
  return new;
end;
$$;
