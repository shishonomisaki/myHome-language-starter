"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getRepo } from "@/lib/repo";
import { supabaseConfigured } from "@/lib/supabase";
import type { Learner } from "@/lib/types";
import SiteGuide from "@/components/SiteGuide";

export default function Home() {
  const [family, setFamily] = useState<Learner[]>([]);
  useEffect(() => {
    getRepo().listLearners().then(setFamily);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">今天誰要練習？</h1>
        {!supabaseConfigured && (
          <p className="text-sm text-black/60 dark:text-white/60">
            試用版：資料先存在這台裝置的瀏覽器，接上資料庫後會全家同步。
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {family
          .filter((l) => l.isLearning)
          .map((l) => (
            <Link key={l.id} href={`/learn/${l.id}`} className="card flex flex-col items-center gap-2 py-6 hover:border-teal-600">
              <span className="text-5xl">{l.avatar}</span>
              <span className="font-medium">{l.nickname}</span>
            </Link>
          ))}
      </div>
      <SiteGuide />
    </div>
  );
}
