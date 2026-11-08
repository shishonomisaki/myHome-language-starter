// 後台新增家人帳號、重設密碼、刪除家人。家人不能自己註冊。
// 超級管理員可以管所有家庭；家庭管理員只能管自己家（不能建超級管理員、不能刪人）。

import { NextResponse } from "next/server";
import { isValidAccountName, loginEmail } from "@/lib/account";
import { canManage, requireManager, requireUser, serviceClient } from "@/lib/supabase-server";
import { DAILY_MINUTE_OPTIONS } from "@/lib/types";

const SIGNED_OUT = "登入已經失效，請登出後重新登入再試一次";

export async function POST(req: Request) {
  if (!(await requireUser(req))) return NextResponse.json({ error: SIGNED_OUT }, { status: 401 });
  const m = await requireManager(req);
  if (!m) return NextResponse.json({ error: "只有管理者可以新增家人" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const account = String(body?.account ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const nickname = String(body?.nickname ?? "").trim();
  const asked = body?.role;
  const role = m.isSuper && asked === "admin" ? "admin" : asked === "family_admin" ? "family_admin" : "learner";
  const householdId = m.isSuper && body?.householdId ? String(body.householdId) : m.householdId;
  const dailyMinutes = DAILY_MINUTE_OPTIONS.includes(body?.dailyMinutes) ? body.dailyMinutes : 15;

  if (!isValidAccountName(account)) return NextResponse.json({ error: "帳號只能用英文小寫、數字、- 或 _，3–20 字" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "密碼至少 8 個字" }, { status: 400 });
  if (!nickname) return NextResponse.json({ error: "請填暱稱" }, { status: 400 });

  const db = serviceClient();
  const { data, error } = await db.auth.admin.createUser({ email: loginEmail(account), password, email_confirm: true });
  if (error || !data.user) {
    const taken = /already|registered|exists/i.test(error?.message ?? "");
    return NextResponse.json({ error: taken ? "這個帳號名稱已經有人用了，請換一個（例如加數字）" : error?.message ?? "建立失敗" }, { status: 400 });
  }

  const { error: profileError } = await db.from("profiles").insert({
    id: data.user.id,
    nickname,
    avatar: String(body?.avatar ?? "🙂").slice(0, 8),
    role,
    household_id: householdId,
    daily_minutes: dailyMinutes,
    languages: { en: 1 },
  });
  if (profileError) {
    await db.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }
  return NextResponse.json({ id: data.user.id });
}

export async function PATCH(req: Request) {
  if (!(await requireUser(req))) return NextResponse.json({ error: SIGNED_OUT }, { status: 401 });
  const m = await requireManager(req);
  if (!m) return NextResponse.json({ error: "只有管理者可以改家人資料" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  if (!id || !(await canManage(m, id))) return NextResponse.json({ error: "找不到這位家人" }, { status: 404 });
  const db = serviceClient();

  // 超級管理員：換家庭、改角色。
  if (body?.householdId !== undefined || body?.role !== undefined) {
    if (!m.isSuper) return NextResponse.json({ error: "只有超級管理員可以換家庭或改角色" }, { status: 403 });
    const patch: Record<string, string> = {};
    if (body.householdId) patch.household_id = String(body.householdId);
    if (["admin", "family_admin", "learner"].includes(body.role)) patch.role = body.role;
    const { error } = await db.from("profiles").update(patch).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const password = String(body?.password ?? "");
  if (password.length < 8) return NextResponse.json({ error: "密碼至少 8 個字" }, { status: 400 });
  const { error } = await db.auth.admin.updateUserById(id, { password });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

/** 刪除家人：帳號和他的進度、作答一起刪掉（資料表設了連動刪除），不影響別人和共用題庫。 */
export async function DELETE(req: Request) {
  if (!(await requireUser(req))) return NextResponse.json({ error: SIGNED_OUT }, { status: 401 });
  const m = await requireManager(req);
  if (!m?.isSuper) return NextResponse.json({ error: "只有超級管理員可以刪除家人" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  if (!id || id === m.id) return NextResponse.json({ error: "不能刪除自己" }, { status: 400 });
  const { error } = await serviceClient().auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
