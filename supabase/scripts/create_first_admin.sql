-- 建立第一個管理者：先在 Supabase → Authentication → Users → Add user 建好帳號
-- （Email 填「帳號名稱@myhome.family」，例如 dad@myhome.family，勾 Auto Confirm），
-- 再把下面 ① ② ③ 改掉，整份貼到 SQL Editor 按 Run。
--   ① 剛才的帳號名稱（@ 前面那段）
--   ② 網站上顯示的暱稱
--   ③ 你的家庭名稱

do $$
declare
  acct text := '① dad';
  nick text := '② 爸爸';
  fam  text := '③ 我的家';
  uid uuid;
begin
  if acct like '①%' or nick like '②%' or fam like '③%' then
    raise exception '還有 ① ② ③ 沒改，請改好再執行';
  end if;
  select id into uid from auth.users where email = lower(acct) || '@myhome.family';
  if uid is null then
    raise exception '找不到帳號 %@myhome.family，請先在 Authentication → Users 建立', acct;
  end if;
  update households set name = fam where id = '00000000-0000-0000-0000-000000000001';
  insert into profiles (id, nickname, avatar, role, daily_minutes, languages)
  values (uid, nick, '🦁', 'admin', 30, '{"en": 1}')
  on conflict (id) do update set role = 'admin', nickname = excluded.nickname;
end $$;

select split_part(u.email, '@', 1) as 帳號, p.nickname as 暱稱, p.role as 角色, h.name as 家庭
from profiles p join auth.users u on u.id = p.id join households h on h.id = p.household_id;
