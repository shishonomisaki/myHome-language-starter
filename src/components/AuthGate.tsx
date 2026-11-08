"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { getSupabase } from "@/lib/supabase";
import { isManager } from "@/lib/types";
import { DEMO_ROLES, seedDemoData, setDemoRole } from "@/lib/demo";
import { useAuth } from "./useAuth";

/** 沒登入就導去登入頁；家人只能進自己的頁面，後台只有管理者能進。 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const path = usePathname();
  const router = useRouter();

  const isLogin = path === "/login";
  // 家庭看板用通關碼，不用登入；沒登入時首頁就是看板。
  const isBoard = path === "/board";
  const me = auth.status === "signed-in" ? auth.me : undefined;
  const isAdmin = isManager(me?.role);
  const ownPath = me ? `/learn/${me.id}` : "/login";
  // 試用模式扮演小孩時，跟真的小孩一樣只能進自己的頁面。
  const demoOwn = auth.status === "demo" ? `/learn/${auth.meId}` : "";
  const allowed =
    (auth.status === "demo" && (isManager(auth.role) || path === demoOwn || path.startsWith(`${demoOwn}/`))) ||
    isLogin ||
    isBoard ||
    (auth.status === "signed-in" &&
      !!me &&
      (isAdmin || path === ownPath || path.startsWith(`${ownPath}/`)));

  useEffect(() => {
    if (auth.status === "demo" && !allowed) router.replace(demoOwn);
    else if (auth.status === "signed-out" && !isLogin && !isBoard) router.replace(path === "/" ? "/board" : "/login");
    else if (auth.status === "signed-in" && me && (isLogin || !allowed)) router.replace(isAdmin ? "/" : ownPath);
  }, [auth.status, me, isLogin, isBoard, path, allowed, isAdmin, ownPath, demoOwn, router]);

  if (isBoard) return <>{children}</>;
  if (auth.status === "loading") return <p>載入中…</p>;
  if (auth.status === "signed-in" && !me) {
    return (
      <div className="card space-y-2">
        <p>這個帳號還沒有家人資料，請管理者在後台建立。</p>
        <button type="button" className="btn-ghost" onClick={() => signOutHere()}>
          登出
        </button>
      </div>
    );
  }
  if (!allowed) return <p>載入中…</p>;
  return <>{children}</>;
}

/** 只登出這台裝置。預設的 signOut() 會把同一個帳號在所有裝置都登出，另一台還開著的頁面就會變成半登入狀態。 */
export function signOutHere() {
  return getSupabase().auth.signOut({ scope: "local" });
}

export function SignOutButton() {
  const auth = useAuth();
  if (auth.status !== "signed-in") return null;
  return (
    <button type="button" className="nav-icon" onClick={() => signOutHere()} aria-label="登出" title="登出">
      <span aria-hidden>🚪</span>
    </button>
  );
}

export function AdminLink() {
  const auth = useAuth();
  const show = (auth.status === "demo" && isManager(auth.role)) || (auth.status === "signed-in" && isManager(auth.me?.role));
  if (!show) return null;
  return (
    <Link href="/admin" className="nav-icon" aria-label="後台" title="後台">
      <span aria-hidden>⚙️</span>
    </Link>
  );
}

/** 左上角站名：登入後回自己的學習主頁；管理者另外有「全家」可以看每個人。 */
export function HomeLink() {
  const auth = useAuth();
  const me = auth.status === "signed-in" ? auth.me : undefined;
  return (
    <Link href={me ? `/learn/${me.id}` : "/"} className="shrink-0 whitespace-nowrap text-lg font-semibold text-teal-700 dark:text-teal-400">
      全家多語化
    </Link>
  );
}

export function FamilyLink() {
  const auth = useAuth();
  const show = auth.status === "signed-in" && isManager(auth.me?.role);
  if (!show) return null;
  return (
    <Link href="/" className="nav-icon" aria-label="全家" title="全家">
      <span aria-hidden>👨‍👩‍👧</span>
    </Link>
  );
}

export function BoardLink() {
  return (
    <Link href="/board" className="nav-icon" aria-label="看板" title="看板">
      <span aria-hidden>📊</span>
    </Link>
  );
}

/** 試用模式才出現：切換扮演的角色、灌入示範資料，方便看各角色畫面與截圖。 */
export function DemoRoleSwitcher() {
  const auth = useAuth();
  if (auth.status !== "demo") return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="demo-role-switcher">
      <span className="text-black/60 dark:text-white/60">試用角色：</span>
      {DEMO_ROLES.map((r) => (
        <button
          key={r.id}
          type="button"
          aria-pressed={auth.demoRole === r.id}
          className={`rounded-full border px-2 py-0.5 ${auth.demoRole === r.id ? "border-teal-600 bg-teal-600 text-white" : "border-black/15 dark:border-white/20"}`}
          onClick={() => {
            setDemoRole(r.id);
            window.location.href = isManager(r.role) ? "/" : `/learn/${r.learnerId}`;
          }}
        >
          {r.label}
        </button>
      ))}
      <button
        type="button"
        className="rounded-full border border-black/15 px-2 py-0.5 dark:border-white/20"
        onClick={() => {
          seedDemoData();
          window.location.reload();
        }}
      >
        📊 灌示範資料
      </button>
    </div>
  );
}
