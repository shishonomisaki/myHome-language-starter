// Supabase 連線。沒有設定網址與公開金鑰時，整個站停在試用模式（資料存在瀏覽器）。
// 這裡只用公開的 anon key；service role key 只放在伺服器端，不會進到瀏覽器。

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) throw new Error("Supabase 尚未設定");
  if (!client) client = createBrowserClient(url, anonKey);
  return client;
}
