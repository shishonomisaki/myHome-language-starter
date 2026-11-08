// 瀏覽器端：在背景請伺服器先把下一份強化題目出好，不等結果、失敗也沒關係。
import { getSupabase, supabaseConfigured } from "./supabase";
import { today } from "./dates";

export async function prefetchFocus(body: { language?: string; area?: string; mistakes?: string[] } = {}): Promise<void> {
  if (!supabaseConfigured) return;
  try {
    // 首頁補齊一天只叫一次。
    if (!body.area) {
      const key = `myhome-language:focus-prefetch:${today()}`;
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    }
    const { data } = await getSupabase().auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    void fetch("/api/focus/prefetch", {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch {
    // 背景工作，失敗就算了。
  }
}
