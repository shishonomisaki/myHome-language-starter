import type { SpeakProgress } from "@/lib/speech";

/**
 * 卡拉 OK 式標示：正在唸的那一句淡黃底，正在唸的字加深加底線。
 * base 是這段文字在朗讀內容裡的起點（例如標題和內文一起唸，內文從標題後面開始算）。
 */
export function Highlighted({ text, base = 0, progress }: { text: string; base?: number; progress: SpeakProgress | null }) {
  if (!progress) return <>{text}</>;
  const clip = (n: number) => Math.min(Math.max(n - base, 0), text.length);
  const [s0, s1] = progress.sentence.map(clip);
  const [w0, w1] = progress.word ? progress.word.map(clip) : [s0, s0];
  if (s0 === s1) return <>{text}</>;
  return (
    <>
      {text.slice(0, s0)}
      <mark className="rounded bg-yellow-100 text-inherit dark:bg-yellow-900/60">
        {text.slice(s0, w0)}
        {w1 > w0 && (
          <span className="rounded bg-amber-300 underline decoration-2 underline-offset-4 dark:bg-amber-600">{text.slice(w0, w1)}</span>
        )}
        {text.slice(Math.max(w1, w0), s1)}
      </mark>
      {text.slice(s1)}
    </>
  );
}
