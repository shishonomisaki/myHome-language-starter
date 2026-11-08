"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getRepo } from "@/lib/repo";
import type { Learner } from "@/lib/types";

/** 讀網址裡的家人 id，載入那位家人。 */
export function useLearner() {
  const params = useParams<{ id: string }>();
  const [learner, setLearner] = useState<Learner | null | undefined>(undefined);
  const reload = useCallback(() => {
    getRepo()
      .getLearner(params.id)
      .then((l) => setLearner(l ?? null));
  }, [params.id]);
  useEffect(reload, [reload]);
  return { learner, reload, repo: getRepo() };
}
