-- 管理者指定的強化項目：每人每語言可勾多項（字彙、文法、句型、發音、聽力），只有管理者能改。

alter table profiles add column if not exists focus jsonb not null default '{}';

create or replace function guard_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not is_admin() then
    raise exception '只有管理者能改角色';
  end if;
  if new.focus is distinct from old.focus and not is_admin() then
    raise exception '只有管理者能改強化項目';
  end if;
  return new;
end;
$$;
