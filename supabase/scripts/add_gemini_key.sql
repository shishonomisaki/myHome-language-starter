-- 新增一把 Gemini 金鑰：在 Supabase 後台 SQL Editor 貼上，改好 4 個地方再按 Run。
-- 金鑰只存在 Vault，資料表只記名稱。每把金鑰要來自不同的 Google 帳號／Cloud 專案（額度算在專案上）。
--   ① 貼上金鑰（AI Studio → Get API key 複製）
--   ② Vault 名稱，例如 gemini_key1（不能和現有的重複）
--   ③ 後台顯示的名稱，例如 key1
--   ④ 這把金鑰的 Cloud 專案 ID（AI Studio 金鑰列表上看得到，gen-lang-client-…）
-- 輪換順序自動排在最後一把後面。

with s as (
  select vault.create_secret('① 貼上金鑰', '② gemini_key1') as id
)
insert into public.ai_keys (label, cloud_project, vault_secret_id, rotation_order)
select '③ key1', '④ gen-lang-client-0000000000', s.id,
       coalesce((select max(rotation_order) from public.ai_keys), 0) + 1
from s;
