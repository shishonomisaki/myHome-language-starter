-- 作業延伸教材另外記完成時間：複習和延伸是兩項練習，各自做完各自打勾。
alter table public.class_homework add column if not exists extended_at timestamptz;
grant update (extended_at) on public.class_homework to authenticated;
