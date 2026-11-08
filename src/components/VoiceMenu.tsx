"use client";

import { useEffect, useState } from "react";
import { canSpeak, loadVoices, pickVoice, setPreferredVoice, speak, voicesFor } from "@/lib/speech";
import { LANGUAGE_NAMES, type Language } from "@/lib/types";

const SAMPLE: Record<Language, string> = { en: "Hello, nice to meet you.", ja: "こんにちは。あいうえお。", es: "Hola, mucho gusto. ¿Qué tal?" };
const LANGS: Language[] = ["en", "ja", "es"];

function VoiceSelect({ language }: { language: Language }) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [current, setCurrent] = useState("");

  useEffect(() => {
    loadVoices().then((all) => {
      setVoices(voicesFor(all, language));
      setCurrent(pickVoice(all, language)?.name ?? "");
    });
  }, [language]);

  return (
    <label className="block space-y-1 text-sm">
      <span>{LANGUAGE_NAMES[language]}</span>
      {voices.length < 2 ? (
        <span className="flex items-center gap-2">
          <span className="flex-1 text-xs text-black/60 dark:text-white/60">
            {voices.length ? `這台只有一個語音：${voices[0].name}` : "這台裝置找不到這個語言的語音"}
          </span>
          {voices.length > 0 && (
            <button type="button" className="btn-ghost !px-3 !py-1 text-sm" onClick={() => speak(SAMPLE[language], language)}>
              🔊 試聽
            </button>
          )}
        </span>
      ) : (
        <select
          className="w-full rounded-lg border border-black/15 bg-transparent px-2 py-2 dark:border-white/20"
          value={current}
          onChange={(e) => {
            setCurrent(e.target.value);
            setPreferredVoice(language, e.target.value);
            speak(SAMPLE[language], language);
          }}
        >
          {voices.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name}
            </option>
          ))}
        </select>
      )}
    </label>
  );
}

/** 頁首的 🔈：選這台裝置用哪個聲音朗讀（英語、日語各一個）。有些裝置的語音特別小聲，換一個就好。 */
export function VoiceMenu() {
  const [open, setOpen] = useState(false);
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(canSpeak()), []);
  if (!ok) return null;
  return (
    <span>
      <button type="button" className="nav-icon" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="朗讀語音設定" title="朗讀語音設定">
        <span aria-hidden>🔈</span>
      </button>
      {open && (
        <div role="dialog" aria-label="朗讀語音設定" className="card fixed left-3 right-3 top-16 z-50 mx-auto max-w-sm space-y-3 shadow-lg">
          <p className="text-sm font-semibold">朗讀語音</p>
          <p className="text-xs text-black/60 dark:text-white/60">這台裝置用哪個聲音唸，太小聲就換一個試試。</p>
          {LANGS.map((l) => (
            <VoiceSelect key={l} language={l} />
          ))}
          <button type="button" className="btn-ghost w-full" onClick={() => setOpen(false)}>
            完成
          </button>
        </div>
      )}
    </span>
  );
}
