import { FEATURES, HOW_TO, UPDATES } from "@/content/guide";

export default function SiteGuide({ open = false }: { open?: boolean }) {
  return (
    <details className="card space-y-4" open={open}>
      <summary className="cursor-pointer text-lg font-semibold">💡 這個網站有什麼厲害的？怎麼用？</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="flex gap-3">
            <span className="text-2xl">{f.icon}</span>
            <div>
              <div className="font-medium">{f.title}</div>
              <p className="text-sm text-black/60 dark:text-white/60">{f.text}</p>
            </div>
          </div>
        ))}
      </div>
      <div>
        <h3 className="mt-4 font-semibold">🚀 怎麼開始</h3>
        <ol className="ml-5 list-decimal text-sm">
          {HOW_TO.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </div>
      <div>
        <h3 className="mt-4 font-semibold">🆕 最新更新</h3>
        <ul className="text-sm">
          {UPDATES.slice(0, 6).map((u) => (
            <li key={u.date + u.text}>
              <span className="text-black/50 dark:text-white/50">{u.date.slice(5)}</span> {u.text}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
