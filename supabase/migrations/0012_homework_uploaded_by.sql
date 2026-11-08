-- 家長代傳作業：孩子沒手機時，管理者（爸媽）可以用自己的帳號替孩子拍照錄音。
-- 記下是誰送的；寫入仍只由伺服器（service_role）做，伺服器會檢查代傳者必須是 admin。
alter table public.class_homework
  add column if not exists uploaded_by uuid references public.profiles (id) on delete set null;

-- 資料庫層再擋一次：uploaded_by 不是本人時，一定要是管理者。
create or replace function public.class_homework_check_uploader() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.uploaded_by is not null and new.uploaded_by <> new.learner_id
     and not exists (select 1 from public.profiles where id = new.uploaded_by and role = 'admin') then
    raise exception '只有管理者可以代傳作業';
  end if;
  return new;
end $$;
revoke all on function public.class_homework_check_uploader() from public, anon, authenticated;

drop trigger if exists class_homework_check_uploader on public.class_homework;
create trigger class_homework_check_uploader before insert or update on public.class_homework
  for each row execute function public.class_homework_check_uploader();
