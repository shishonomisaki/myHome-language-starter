"use client";

import Link from "next/link";
import { badgeLabel } from "@/lib/rewards";
import { clampCorrect } from "@/lib/score";

export function SessionDone({
  learnerId,
  correct,
  total,
  result,
}: {
  learnerId: string;
  correct: number;
  total: number;
  result: { goalJustMet: boolean; newBadges: string[]; streak: number } | null;
}) {
  const shown = clampCorrect(correct, total);
  return (
    <div className="card space-y-3 text-center">
      <p className="text-2xl">🎉 完成！</p>
      {total > 0 && (
        <p>
          答對 {shown} / {total} 題
        </p>
      )}
      {result?.goalJustMet && <p className="font-medium text-teal-700 dark:text-teal-400">今天的目標達成了，連續 {result.streak} 天！</p>}
      {result?.newBadges.map((b) => (
        <p key={b}>🏅 新徽章：{badgeLabel(b)}</p>
      ))}
      <Link href={`/learn/${learnerId}`} className="btn">
        回到今天的清單
      </Link>
    </div>
  );
}
