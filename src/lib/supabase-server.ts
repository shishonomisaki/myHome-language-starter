// 伺服器端專用：service role key 只在這裡讀，絕不能 import 到瀏覽器元件。
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function serviceClient(): SupabaseClient {
  if (!url || !serviceKey) throw new Error("伺服器尚未設定 Supabase");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/** 確認呼叫者已登入且是管理者，回傳他的 id；不是就回 null。 */
export async function requireAdmin(req: Request): Promise<string | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anonKey || !token) return null;
  const db = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data } = await db.auth.getUser(token);
  if (!data.user) return null;
  const { data: me } = await db.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  return me?.role === "admin" ? data.user.id : null;
}

export interface Manager {
  id: string;
  role: "admin" | "family_admin";
  householdId: string;
  /** 超級管理員看全部家庭。 */
  isSuper: boolean;
}

/** 確認呼叫者是超級管理員或家庭管理員；不是就回 null。 */
export async function requireManager(req: Request): Promise<Manager | null> {
  const id = await requireUser(req);
  if (!id) return null;
  const { data: me } = await serviceClient().from("profiles").select("role, household_id").eq("id", id).maybeSingle();
  if (me?.role !== "admin" && me?.role !== "family_admin") return null;
  return { id, role: me.role, householdId: me.household_id, isSuper: me.role === "admin" };
}

/** 這位管理者可以管這位家人嗎？超級管理員全部可以，家庭管理員只限同家庭。 */
export async function canManage(m: Manager, learnerId: string): Promise<boolean> {
  if (m.isSuper) return true;
  const { data } = await serviceClient().from("profiles").select("household_id").eq("id", learnerId).maybeSingle();
  return !!data && data.household_id === m.householdId;
}

/** 確認呼叫者已登入，回傳他的 id；沒登入就回 null。 */
export async function requireUser(req: Request): Promise<string | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anonKey || !token) return null;
  const db = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data } = await db.auth.getUser(token);
  return data.user?.id ?? null;
}
