import { BAND_LABEL, scoreBand } from "@/lib/score-band";

const COLOR = {
  pass: "bg-green-500",
  close: "bg-amber-400",
  weak: "bg-red-500",
} as const;

/** 句子前的色球：沒唸過是灰色空心，唸過依最高分顯示 🟢🟡🔴（分數只在講評裡）。 */
export function ScoreDot({ score }: { score?: number }) {
  if (score === undefined) {
    return (
      <span
        aria-label="還沒唸"
        title="還沒唸"
        className="inline-block h-3 w-3 shrink-0 rounded-full border border-black/30 dark:border-white/40"
      />
    );
  }
  const band = scoreBand(score);
  return (
    <span title={BAND_LABEL[band]} className="inline-flex shrink-0 items-center">
      <span aria-hidden className={`inline-block h-3 w-3 rounded-full ${COLOR[band]}`} />
      <span className="sr-only">{BAND_LABEL[band]}</span>
    </span>
  );
}
