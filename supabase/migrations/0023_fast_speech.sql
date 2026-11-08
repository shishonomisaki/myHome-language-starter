-- 後台可以替每位家人開放「快速朗讀」🐇：打開才會在朗讀語速多一段母語人士聊天的速度，預設關閉。
alter table public.profiles add column if not exists fast_speech boolean not null default false;
