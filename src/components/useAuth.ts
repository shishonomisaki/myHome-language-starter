"use client";

import { useEffect, useState } from "react";
import { getRepo } from "@/lib/repo";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import { setFastAllowed } from "@/lib/speech-speed";
import type { Learner, Role } from "@/lib/types";
import { DEMO_ROLES, readDemoRole, type DemoRole } from "@/lib/demo";

export type AuthState =
  | { status: "loading" }
  | { status: "demo"; demoRole: DemoRole; role: Role; meId: string }
  | { status: "signed-out" }
  | { status: "signed-in"; me: Learner | undefined };

/** 試用模式不用登入；接上 Supabase 後讀目前登入的家人。 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(supabaseConfigured ? { status: "loading" } : demoState("super"));

  useEffect(() => {
    // 試用模式沒有後台設定，直接開放給大家看效果。
    if (!supabaseConfigured) {
      setState(demoState(readDemoRole()));
      return setFastAllowed(true);
    }
    const db = getSupabase();
    const load = async (userId: string | undefined) => {
      if (!userId) return setState({ status: "signed-out" });
      const me = await getRepo().getLearner(userId);
      // 後台有替這位家人開「快速朗讀」，朗讀語速才會有 🐇。
      setFastAllowed(me?.fastSpeech === true);
      setState({ status: "signed-in", me });
    };
    db.auth.getUser().then(({ data, error }) => {
      // 這次登入已在別處被登出（伺服器說 session 不存在），就清掉這台裝置留下的登入，請他重新登入。
      if (error?.status === 401 || error?.status === 403) return void db.auth.signOut({ scope: "local" });
      load(data.user?.id);
    });
    // 不能在 onAuthStateChange 裡直接 await 其他 Supabase 查詢：會卡住登入鎖，之後所有請求都停住。
    // 先讓回呼結束，再到下一輪讀家人資料。
    const { data } = db.auth.onAuthStateChange((_event, session) => {
      const id = session?.user.id;
      setTimeout(() => load(id), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return state;
}

/** 試用模式扮演的角色（網址 ?demo=super|family|kid 切換，見 lib/demo.ts）。 */
function demoState(id: DemoRole): AuthState {
  const d = DEMO_ROLES.find((r) => r.id === id) ?? DEMO_ROLES[0];
  return { status: "demo", demoRole: d.id, role: d.role, meId: d.learnerId };
}
