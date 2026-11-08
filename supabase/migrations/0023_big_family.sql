-- 大家庭模式：打開後，任何一家的看板通關碼都看得到同一親族圈所有人的卡片。可隨時關掉。
alter table family_settings add column if not exists big_family boolean not null default false;
