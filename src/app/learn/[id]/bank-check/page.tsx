"use client";

import Link from "next/link";
import { BankReview } from "@/components/BankReview";
import { useLearner } from "@/components/useLearner";

/** 家長的練習項目：抽查 Claude 標「不確定」的英文題目。 */
export default function BankCheckPage() {
  const { learner } = useLearner();
  if (learner === null) return <p>找不到這位家人。</p>;
  if (!learner) return <p>載入中…</p>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-black/60 dark:text-white/60">
        這些是 Claude 審過、但不太確定的英文題目。答案沒問題按「可以用」，有錯按 ✖。
      </p>
      <BankReview checkerId={learner.id} />
      <Link href={`/learn/${learner.id}`} className="btn">
        回到今天的清單
      </Link>
    </div>
  );
}
