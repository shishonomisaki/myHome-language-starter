-- 收緊 SECURITY DEFINER 函式的執行權（Supabase 安全檢查建議）。
-- 已在正式資料庫套用（2026-10-21）。

revoke execute on function guard_profile_role() from public, anon, authenticated;
-- rls_auto_enable 是建專案時勾「Enable automatic RLS」才會有的函式，沒有就跳過。
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;
revoke execute on function is_admin() from public, anon;
grant execute on function is_admin() to authenticated;
revoke execute on function add_minutes(uuid, date, numeric) from public, anon;
