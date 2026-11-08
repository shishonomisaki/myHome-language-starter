"use client";

import { useEffect, useState } from "react";
import { toastOk } from "@/components/Toast";

/** 佈景主題：跟隨系統、柔和日間、夜間，再加三個色調。每按一次換下一個，選擇存在這台裝置上。 */
export const THEMES = [
  { key: "system", name: "跟隨系統", note: "手機是夜間就用夜間" },
  { key: "soft", name: "柔和日間", note: "" },
  { key: "dark", name: "夜間", note: "" },
  { key: "sage", name: "護眼綠", note: "" },
  { key: "sand", name: "暖沙", note: "" },
  { key: "slate", name: "海霧藍", note: "" },
] as const;

export type ThemeKey = (typeof THEMES)[number]["key"];

const KEY = "theme";

/** 畫面出來前先套好主題，避免夜間模式先閃一下白色。舊的 light 當作柔和日間。 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${KEY}");if(t==="light")t="soft";var m=["soft","dark","sage","sand","slate"];var e=document.documentElement;if(m.indexOf(t)>=0)e.setAttribute("data-theme",t);if(t==="dark"||(m.indexOf(t)<0&&matchMedia("(prefers-color-scheme: dark)").matches))e.classList.add("dark")}catch(e){}`;

export function nextTheme(t: ThemeKey): ThemeKey {
  const i = THEMES.findIndex((x) => x.key === t);
  return THEMES[(i + 1) % THEMES.length].key;
}

function apply(theme: ThemeKey) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
}

/** 頁首的 🎨：每按一次換一個佈景主題，並在畫面下方說現在是哪一個。 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeKey | null>(null);

  useEffect(() => {
    let saved: ThemeKey = "system";
    try {
      let t = localStorage.getItem(KEY);
      if (t === "light") t = "soft";
      if (THEMES.some((x) => x.key === t && x.key !== "system")) saved = t as ThemeKey;
    } catch {
      // 讀不到就跟隨系統。
    }
    setTheme(saved);
  }, []);

  // 跟隨系統時，系統切換日夜也跟著變。
  useEffect(() => {
    if (!theme) return;
    apply(theme);
    if (theme !== "system") return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const change = () => apply("system");
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, [theme]);

  function next() {
    const t = nextTheme(theme ?? "system");
    setTheme(t);
    try {
      if (t === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, t);
    } catch {
      // 存不了就只有這次有效。
    }
    const info = THEMES.find((x) => x.key === t);
    toastOk(`佈景主題：${info?.name}${info?.note ? `（${info.note}）` : ""}`);
  }

  const name = THEMES.find((x) => x.key === (theme ?? "system"))?.name;
  return (
    <button type="button" className="nav-icon" onClick={next} aria-label={`佈景主題：${name}（按一下換）`} title={`佈景主題：${name}（按一下換）`}>
      <span aria-hidden>🎨</span>
    </button>
  );
}
