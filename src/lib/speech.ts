// 朗讀用瀏覽器內建功能（免費）。跟讀時同時錄音：有 Gemini 就交給它嚴格評分，沒有就用瀏覽器辨識比對。

import type { Language } from "./types";

// 西語預設拉美腔（es-MX）；🔈 可改選 es-ES 或其他西語語音。
const VOICE_LANG: Record<Language, string> = { en: "en-US", ja: "ja-JP", es: "es-MX" };

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** 給語音打分：同語系、名字像高品質（Neural、Natural、Google、Premium、Enhanced）的優先，其次是本機語音。 */
export function voiceScore(v: { lang: string; name: string; localService: boolean }, language: Language): number {
  const want = VOICE_LANG[language].toLowerCase();
  const lang = v.lang.toLowerCase().replace("_", "-");
  if (!lang.startsWith(want.slice(0, 2))) return -1;
  let score = lang === want ? 10 : 5;
  if (/neural|natural|premium|enhanced|online/i.test(v.name)) score += 20;
  if (/google/i.test(v.name)) score += 15;
  if (/compact|espeak/i.test(v.name)) score -= 10;
  if (v.localService) score += 1;
  return score;
}

export function bestVoice(voices: SpeechSynthesisVoice[], language: Language): SpeechSynthesisVoice | undefined {
  let best: SpeechSynthesisVoice | undefined;
  let top = -1;
  for (const v of voices) {
    const s = voiceScore(v, language);
    if (s > top) [best, top] = [v, s];
  }
  return best;
}

/** 這台裝置上這個語言能用的語音，好的排前面。 */
export function voicesFor(voices: SpeechSynthesisVoice[], language: Language): SpeechSynthesisVoice[] {
  return voices.filter((v) => voiceScore(v, language) >= 0).sort((a, b) => voiceScore(b, language) - voiceScore(a, language));
}

const prefKey = (language: Language) => `voice:${language}`;

/** 使用者自己選的語音（例如筆電上某個日語語音太小聲，換一個）。存在這台裝置上。 */
export function preferredVoiceName(language: Language): string {
  try {
    return localStorage.getItem(prefKey(language)) ?? "";
  } catch {
    return "";
  }
}

export function setPreferredVoice(language: Language, name: string) {
  try {
    if (name) localStorage.setItem(prefKey(language), name);
    else localStorage.removeItem(prefKey(language));
  } catch {
    // 儲存被擋時，只是下次要再選一次。
  }
}

/** 先用使用者選的語音，沒選或這台沒有就自動挑最好的。 */
export function pickVoice(voices: SpeechSynthesisVoice[], language: Language): SpeechSynthesisVoice | undefined {
  const name = preferredVoiceName(language);
  return (name && voicesFor(voices, language).find((v) => v.name === name)) || bestVoice(voices, language);
}

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;

/** Chrome 一開始 getVoices() 是空的，要等 voiceschanged；最多等 1.5 秒。 */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!canSpeak()) return Promise.resolve([]);
  const now = window.speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  voicesReady ??= new Promise<SpeechSynthesisVoice[]>((resolve) => {
    const done = () => resolve(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener("voiceschanged", done, {
      once: true,
    });
    setTimeout(done, 1500);
  }).then((v) => {
    if (!v.length) voicesReady = null; // 下次再試
    return v;
  });
  return voicesReady;
}

export const SPEECH_PROBLEM_EVENT = "speech-problem";

const NO_VOICE_HELP: Record<Language, string> = {
  en: "這台裝置找不到英語語音。",
  es: "這台裝置找不到西語語音。電腦請用 Chrome 或 Edge（內建線上西語語音），或在 Windows「設定 › 時間與語言 › 語音 › 新增語音」加裝 Español；手機請在「文字轉語音」設定下載西班牙語語音。",
  ja: "這台裝置找不到日語語音，所以點字沒有聲音。電腦請用 Chrome 或 Edge（內建線上日語語音），或在 Windows「設定 › 時間與語言 › 語音 › 新增語音」加裝日本語；手機請在「文字轉語音」設定下載日語語音。",
};

/** Linux（例如 Raspberry Pi）上的 Chromium 預設沒有任何語音，要裝語音引擎並加啟動參數。 */
const LINUX_HELP =
  "這台是 Linux（例如 Raspberry Pi），Chromium 預設沒有朗讀語音：請家長在終端機執行 sudo apt install speech-dispatcher espeak-ng，並用 chromium-browser --enable-speech-dispatcher 開瀏覽器。";

function isLinuxDesktop(): boolean {
  return typeof navigator !== "undefined" && /Linux/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent);
}

function noVoiceHelp(language: Language): string {
  return isLinuxDesktop() ? `${NO_VOICE_HELP[language]}${LINUX_HELP}` : NO_VOICE_HELP[language];
}

/** 朗讀出問題時通知畫面上方的提示列（SpeechNotice）。 */
function reportProblem(message: string) {
  window.dispatchEvent(new CustomEvent(SPEECH_PROBLEM_EVENT, { detail: message }));
}

export const SPEAKING_EVENT = "speaking-changed";

/** 朗讀狀態：沒在唸、正在唸、暫停中。 */
export type SpeakState = "idle" | "speaking" | "paused";

let currentState: SpeakState = "idle";
export function speakState() {
  return currentState;
}

function setSpeaking(state: SpeakState) {
  currentState = state;
  window.dispatchEvent(new CustomEvent(SPEAKING_EVENT, { detail: state }));
}

/** 最近一次朗讀的內容與唸到哪一段開頭，給暫停後「繼續」從那一句接著唸。 */
let lastSpeak: { input: string; language: Language; speed: number; one: boolean; onProgress?: (p: SpeakProgress | null) => void } | null = null;
let currentStart = 0;
let pausedAt: number | null = null;
/** 這一句目前唸到（亮到）的字，原文字元位置；暫停用。 */
let lastWordAt: number | null = null;

/**
 * 暫停：記住唸到哪一句，停掉語音但保留畫面上的標示。
 * 不用 speechSynthesis.pause()，因為手機上常常 resume 不回來；改成繼續時從那一句重新唸。
 */
export function pauseSpeaking() {
  if (!canSpeak() || !lastSpeak) return;
  // 停在唸到的那個字（不是句首），按繼續從那個字接著唸；還沒唸到任何字就從這句開頭。
  pausedAt = lastWordAt !== null && lastWordAt >= currentStart ? lastWordAt : currentStart;
  queue = [];
  window.speechSynthesis.cancel();
  setSpeaking("paused");
}

export function resumeSpeaking() {
  if (pausedAt === null || !lastSpeak) return;
  const { input, language, speed, onProgress, one } = lastSpeak;
  const from = pausedAt;
  pausedAt = null;
  void speak(input, language, speed, onProgress, from, one);
}

/** 重唸正在唸（或剛唸完）的那一句；slow 就放慢。唸完就停，要接著唸下一句請按「下一句」。 */
export function replaySentence(slow = false) {
  if (!lastSpeak) return;
  const { input, language, speed, onProgress } = lastSpeak;
  // 單句放慢只是這一次，「繼續」要回到原本的速度。
  void speak(input, language, slow ? SLOW_RATE : speed, onProgress, currentStart, true).then(() => {
    if (lastSpeak) lastSpeak = { ...lastSpeak, speed };
  });
}

/** 換語速：正在唸時從目前這一句用新的速度接著唸；暫停中只記住，按繼續才用新速度；沒在唸就不動。 */
export function changeSpeed(rate: number) {
  if (!lastSpeak || currentState === "idle") return;
  if (currentState === "paused") {
    lastSpeak = { ...lastSpeak, speed: rate };
    return;
  }
  const { input, language, onProgress, one } = lastSpeak;
  void speak(input, language, rate, onProgress, currentStart, one);
}

/** 目前（或剛才）唸的是不是「只唸一句」。 */
export function isSingleSentence(): boolean {
  return lastSpeak?.one ?? false;
}

/** 下一句開始的位置（原文字元索引）；已經是最後一句回 null。 */
export function nextSentenceStart(): number | null {
  if (!lastSpeak) return null;
  const parts = splitWithOffsets(lastSpeak.input);
  const next = parts.find((p) => p.start > currentStart);
  return next ? next.start : null;
}

/** 跳到下一句，接著把剩下的唸完（不管現在是唸中、暫停、或剛唸完一句）。 */
export function skipToNext() {
  if (!lastSpeak) return;
  const at = nextSentenceStart();
  if (at === null) return stopSpeaking();
  const { input, language, speed, onProgress } = lastSpeak;
  void speak(input, language, speed, onProgress, at);
}

export const SLOW_RATE = 0.4;

/** 這一頁有沒有唸過東西（控制列的「重唸／放慢」要有內容才能按）。 */
export function hasLastSpeech() {
  return lastSpeak !== null;
}

/** 換頁時忘掉上一頁唸的內容，免得在新頁面按「重唸」唸出上一頁的字。 */
export function forgetLastSpeech() {
  lastSpeak = null;
  currentStart = 0;
  pausedAt = null;
}

/** 停止朗讀（換頁、切到別的分頁、開始跟讀時都會呼叫）。 */
export function stopSpeaking() {
  if (!canSpeak()) return;
  queue = [];
  pausedAt = null;
  window.speechSynthesis.cancel();
  setSpeaking("idle");
  setProgress(null);
}

// 切到別的分頁或關掉頁面就停止朗讀，不要在背景一直唸。
if (typeof window !== "undefined" && typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => document.hidden && stopSpeaking());
  window.addEventListener("pagehide", stopSpeaking);
}

export type SpeakResult = "ok" | "unsupported" | "no-voice" | "silent" | "error";

/** 長文切成一句一句排隊唸：Chrome 一次唸太長會中途停掉，手機上整段丟進去有時完全不出聲。 */
export function splitForSpeech(text: string, max = 160): string[] {
  return splitWithOffsets(text, max).map((p) => p.text);
}

/** 同 splitForSpeech，另外記下每段在原文的位置，給唸到哪就標到哪用。 */
export function splitWithOffsets(text: string, max = 160): { text: string; start: number }[] {
  const out: { text: string; start: number }[] = [];
  let cursor = 0;
  const push = (part: string) => {
    const start = Math.max(text.indexOf(part, cursor), cursor);
    out.push({ text: part, start });
    cursor = start + part.length;
  };
  for (const sentence of text.split(/(?<=[.!?。！？])\s*/)) {
    let rest = sentence.trim();
    while (rest.length > max) {
      const cut = Math.max(rest.lastIndexOf(",", max), rest.lastIndexOf("、", max), rest.lastIndexOf(" ", max));
      const at = cut > max / 2 ? cut + 1 : max;
      push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
    if (rest) push(rest);
  }
  return out;
}

/** 朗讀進度：正在唸的那一段，以及（語音有回報的話）正在唸的字，位置都是原文的字元索引。 */
export interface SpeakProgress {
  sentence: [number, number];
  word?: [number, number];
}

/** 從 boundary 事件推出這個字的結尾：有 charLength 就用，沒有就找下一個空白（日文沒空白就標一個字）。 */
export function wordEnd(part: string, charIndex: number, charLength?: number): number {
  if (charLength) return charIndex + charLength;
  const m = /[\s,.!?、。！？]/.exec(part.slice(charIndex + 1));
  return m ? charIndex + 1 + m.index : part.length;
}

/** 標題和內文接起來一起唸；回傳內文在朗讀內容裡的起點，給標示位置用。 */
export function withTitle(title: string, text: string, language: Language): { spoken: string; textStart: number } {
  const end = /[.!?。！？]$/.test(title) ? "" : language === "ja" ? "。" : ".";
  const head = `${title}${end}${language === "ja" ? "" : " "}`;
  return { spoken: head + text, textStart: head.length };
}

let progressListener: ((p: SpeakProgress | null) => void) | undefined;

/** 快速（🐇）語速太快，逐字亮燈跟不上也看不清，只標整句。 */
export const WORD_LIGHT_MAX_RATE = 1.05;
let wordLight = true;

function setProgress(p: SpeakProgress | null) {
  if (p?.word) {
    lastWordAt = p.word[0];
    if (!wordLight) p = { sentence: p.sentence };
  }
  progressListener?.(p);
  if (!p) progressListener = undefined;
}

/**
 * 單一個假名只唸一瞬間，喇叭剛啟動時常被吃掉，聽起來幾乎沒聲音。
 * 很短的日文改成慢一點、連唸三次（用句號隔開，中間停久一點比較好跟）。
 */
export function forShortSpeech(text: string, language: Language, rate: number): { text: string; rate: number } {
  const t = text.trim();
  if (language !== "ja" || t.length > 2) return { text, rate };
  return { text: `${t}。${t}。${t}。`, rate: Math.min(rate, 0.7) };
}

/** 開始唸後這麼久還沒收到任何字的回報，就改用時間估計唸到哪個字。 */
export const ESTIMATE_AFTER_MS = 400;
/** 收過字的回報後，又這麼久沒有下一個，就從上一個字接著估計。 */
export const RESUME_ESTIMATE_MS = 1500;

/** from 這個字之後的下一個字從哪裡開始；沒有下一個字回 null。 */
export function nextWord(part: string, from: number, language: Language): number | null {
  if (from < 0) return 0;
  if (language === "ja") return from + 1 < part.length ? from + 1 : null;
  const m = /\s+\S/.exec(part.slice(from));
  return m ? from + m.index + m[0].length - 1 : null;
}

/**
 * 收過字的回報後，等多久沒下一個才改用估計：約兩個字的時間（介於 0.5～1.5 秒）。
 * 以前固定等 1.5 秒，亮燈會先卡住、再一口氣跳好幾個字，看起來很怪。
 */
export function resumeDelay(pace: number, language: Language): number {
  const word = language === "ja" ? 1 : 6;
  return Math.min(RESUME_ESTIMATE_MS, Math.max(500, (2 * word * 1000) / Math.max(pace, 1)));
}

/** 標點後面的停頓，折算成幾個字元的時間。 */
const PAUSE: Record<string, number> = {
  ",": 4,
  ";": 5,
  ":": 4,
  "—": 4,
  ".": 6,
  "!": 6,
  "?": 6,
  "、": 2,
  "，": 2,
  "。": 3,
  "！": 3,
  "？": 3,
};
const weight = (c: string) => 1 + (PAUSE[c] ?? 0);

/** 一段文字唸起來大約等於幾個字元的時間（含標點停頓）。 */
export function spokenLength(part: string): number {
  let n = 0;
  for (const c of part) n += weight(c);
  return n;
}

/** 沒量過這個語音時的預設：英文每秒約 14 個字元、日文約 7 個，再乘上語速。 */
export function defaultPace(rate: number, language: Language): number {
  return (language === "ja" ? 7 : 14) * rate;
}

/**
 * 語音沒回報唸到哪個字時，用經過的時間估計：從第 from 個字元起、每秒 pace 個字元（標點另外算停頓）。
 * 回傳這段文字裡的 [開始, 結束]；估計已經唸完就回 null。
 */
export function estimateAt(part: string, from: number, elapsedMs: number, pace: number, language: Language): [number, number] | null {
  let budget = (elapsedMs / 1000) * pace;
  let at = from;
  while (at < part.length && budget >= weight(part[at])) budget -= weight(part[at++]);
  if (at >= part.length) return null;
  if (language === "ja") return [at, at + 1];
  const begin = part.lastIndexOf(" ", at) + 1;
  return [begin, wordEnd(part, begin)];
}

export function estimateWord(part: string, elapsedMs: number, rate: number, language: Language): [number, number] | null {
  return estimateAt(part, 0, elapsedMs, defaultPace(rate, language), language);
}

// 每個語音、每種語速實際唸多快（每秒幾個字元），唸完一句就更新，下一句的估計就會跟上。
const PACE_KEY = "speech-pace";
const paceKey = (voice: string, rate: number) => `${voice}@${rate.toFixed(2)}`;

export function loadPace(voice: string, rate: number, language: Language): number {
  try {
    const all = JSON.parse(localStorage.getItem(PACE_KEY) ?? "{}");
    const saved = all[paceKey(voice, rate)];
    if (typeof saved === "number" && saved > 0) return saved;
    // 這個語速還沒量過（例如第一次按慢速），就拿同一個語音在最接近語速量到的速度換算，比固定預設準。
    let best: { pace: number; rate: number } | null = null;
    for (const [key, value] of Object.entries(all)) {
      const at = key.lastIndexOf("@");
      if (key.slice(0, at) !== voice || typeof value !== "number" || value <= 0) continue;
      const r = Number(key.slice(at + 1));
      if (!(r > 0)) continue;
      if (!best || Math.abs(r - rate) < Math.abs(best.rate - rate)) best = { pace: value, rate: r };
    }
    // 慢速時語音引擎實際速度不是照語速等比例變慢（比預期快），用 0.75 次方換算比較貼近；唸過之後會用實測的。
    if (best) return best.pace * Math.pow(rate / best.rate, 0.75);
  } catch {
    // 讀不到就用預設。
  }
  return defaultPace(rate, language);
}

export function savePace(voice: string, rate: number, part: string, durationMs: number) {
  const length = spokenLength(part);
  if (length < 15 || durationMs < 500) return;
  const measured = length / (durationMs / 1000);
  try {
    const all = JSON.parse(localStorage.getItem(PACE_KEY) ?? "{}");
    const key = paceKey(voice, rate);
    // 每次往新量到的速度靠過去一大半，很快對齊。
    const old = typeof all[key] === "number" ? all[key] : null;
    all[key] = old !== null ? old * 0.4 + measured * 0.6 : measured;
    localStorage.setItem(PACE_KEY, JSON.stringify(all));
  } catch {
    // 存不了就每次用預設。
  }
}

/** 打斷正在唸的語音後，隔一下再開始唸新的。 */
export const CANCEL_GAP_MS = 120;

// 留住正在唸的句子，避免 Chrome 把它回收掉而中途沒聲音。
let queue: SpeechSynthesisUtterance[] = [];
// 每句開始計時的函式（onstart 沒來時由別處代為觸發）。
const starters = new WeakMap<SpeechSynthesisUtterance, (real: boolean) => void>();
/** 打斷後重唸時，onstart 沒來就在這麼久後自己開始計時。 */
export const START_FALLBACK_MS = 350;
/** 自己先開始計時後，這段時間內真的 onstart 來了就以它為準重新計時。 */
const LATE_START_MS = 2500;
/** 自己猜的開始時間，往後挪這麼多毫秒（句首聲音常常晚出來）。 */
const GUESSED_START_LAG_MS = 250;

/** 這次開網頁後唸失敗過的語音名稱（換掉不用）。 */
const failedVoices = new Set<string>();
const RETRY_ERRORS = new Set(["synthesis-failed", "synthesis-unavailable", "voice-unavailable", "network", "audio-hardware"]);

/** 把瀏覽器的錯誤代碼換成看得懂的話。 */
export function friendlySpeechError(code: string): string {
  switch (code) {
    case "not-allowed":
      return "朗讀被瀏覽器擋住了，請先在頁面上點一下再試。";
    case "audio-busy":
    case "audio-hardware":
      return "喇叭正被別的程式使用（例如影片或通話），關掉後再點一次。";
    case "network":
      return "朗讀需要網路，請確認連線後再點一次。";
    case "synthesis-failed":
    case "synthesis-unavailable":
    case "voice-unavailable":
      return "這台裝置的語音暫時唸不出來，請再點一次；還是不行，到設定換一個語音試試。";
    case "text-too-long":
      return "這段太長唸不完，請改點單一句子。";
    default:
      return `朗讀失敗，請再點一次（${code}）。`;
  }
}

/**
 * 朗讀。語音清單已經載好時同步呼叫 speak()，保住手機瀏覽器要求的「使用者點擊」；
 * 沒有該語言語音、或 3 秒內沒開始唸，就在畫面上方說明原因。
 */
export async function speak(
  input: string,
  language: Language,
  speed = 0.85,
  onProgress?: (p: SpeakProgress | null) => void,
  /** 從原文第幾個字元開始唸（暫停後繼續、點某一句用）。 */
  from = 0,
  /** 只唸一句，唸完就停；要接著唸下一句用 skipToNext()。 */
  one = false,
): Promise<SpeakResult> {
  const { text, rate } = forShortSpeech(input, language, speed);
  wordLight = rate <= WORD_LIGHT_MAX_RATE;
  if (!canSpeak()) {
    reportProblem("這個瀏覽器不能朗讀，請用 Chrome 或 Edge。");
    return "unsupported";
  }
  const synth = window.speechSynthesis;
  let voices = synth.getVoices();
  if (!voices.length) voices = await loadVoices();
  let voice = pickVoice(voices, language);
  if (voices.length && !voice) {
    reportProblem(noVoiceHelp(language));
    return "no-voice";
  }
  // 這台裝置上剛剛唸失敗過的語音（常見是線上語音斷線、或存的語音這台沒有）就換同語言的其他語音，都不行就交給瀏覽器預設。
  if (voice && failedVoices.has(voice.name)) voice = voicesFor(voices, language).find((v) => !failedVoices.has(v.name));
  // Chrome 在 cancel() 後立刻 speak()，新句子常收不到 onstart／onboundary，畫面標示就卡在舊的地方。
  const interrupted = synth.speaking || synth.pending;
  if (interrupted) synth.cancel();
  if (synth.paused) synth.resume();
  if (from === 0 || progressListener !== onProgress) setProgress(null);
  progressListener = onProgress;
  lastSpeak = { input, language, speed, one, onProgress };
  pausedAt = null;
  const all = text === input ? splitWithOffsets(text) : [{ text, start: 0 }];
  // from 落在某一句中間（暫停後繼續）就只唸那句剩下的部分，亮燈仍標整句。
  const rest = all.flatMap((p) => {
    if (p.start >= from) return [{ ...p, sentenceStart: p.start }];
    if (from < p.start + p.text.length) return [{ text: p.text.slice(from - p.start), start: from, sentenceStart: p.start }];
    return [];
  });
  const parts = one ? rest.slice(0, 1) : rest;
  queue = parts.map(({ text: part, start, sentenceStart }, index) => {
    const u = new SpeechSynthesisUtterance(part);
    const sentence: [number, number] = [sentenceStart, start + part.length];
    // 有些語音（或重唸、放慢後）不回報唸到哪個字、或只回報一部分，就照這個語音量過的速度估計，讓逐字標示還是會跟著動。
    const voiceName = voice?.name ?? "default";
    let pace = defaultPace(rate, language);
    let heard = false;
    let anchor = { at: 0, time: 0 };
    // 目前亮到這句的第幾個字元（只給估計用，確保估計不倒退）。
    let lit = -1;
    let t0 = 0;
    let realStart = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const stopEstimate = () => clearInterval(timer);
    // 開始計時。正常由 onstart 觸發；但 Chrome 在切換一般／慢速（cancel 後馬上 speak）時常常不發 onstart，
    // 以前這樣計時就不會開始、亮燈停在原地落後聲音，所以也讓第一個字的 boundary、上一句結束、或保底計時器來開始。
    const begin = (real: boolean) => {
      if (!queue.includes(u)) return;
      if (t0 && (realStart || !real || heard || Date.now() - t0 > LATE_START_MS)) return;
      realStart = real;
      currentStart = sentenceStart;
      lastWordAt = null;
      if (!heard) setProgress({ sentence });
      t0 = Date.now();
      // 沒收到真的 onstart 時，聲音通常比我們猜的晚一點才出來；起點往後挪一點，句首寧可慢半拍也不要搶拍。
      if (!heard) anchor = { at: 0, time: t0 + (real ? 0 : GUESSED_START_LAG_MS) };
      // 每一句開始才讀速度，前一句剛量到的速度這一句就用得上（以前整段都用按下播放那一刻的速度）。
      pace = loadPace(voiceName, rate, language);
      stopEstimate();
      timer = setInterval(() => {
        if (!queue.includes(u)) return stopEstimate();
        const elapsed = Date.now() - anchor.time;
        if (elapsed < (heard ? resumeDelay(pace, language) : ESTIMATE_AFTER_MS)) return;
        const w = estimateAt(part, anchor.at, elapsed, pace, language);
        // 估計只往前走，不往回跳；估到句尾就停在最後一個字等真的唸完。
        if (w && w[0] > lit) {
          lit = w[0];
          setProgress({ sentence, word: [start + w[0], start + w[1]] });
        }
      }, 150);
    };
    starters.set(u, begin);
    u.onstart = () => begin(true);
    u.addEventListener("end", () => {
      stopEstimate();
      // 自動校正：每唸完一句，拿「實際花多久」更新這個語音這個語速的速度，下一句的估計就對得上。
      // 沒收到真的 onstart 時（Chrome 切換語速後常見），第二句起是從上一句結束算起，一樣準，也拿來校正。
      if (t0 && (realStart || index > 0) && queue.includes(u)) savePace(voiceName, rate, part, Date.now() - t0);
      // 下一句如果收不到 onstart，就從這一句結束時開始算。
      const i = queue.indexOf(u);
      const after = i >= 0 ? queue[i + 1] : undefined;
      if (after) starters.get(after)?.(false);
    });
    u.addEventListener("error", stopEstimate);
    u.onboundary = (e) => {
      if (!queue.includes(u) || e.name === "sentence") return;
      if (!t0) begin(false);
      const now = Date.now();
      // 自動校正（句中）：語音有回報位置，就用「到這個字花了多久」更新這一句的速度，字與字之間的估計才不會偏。
      const since = now - (t0 + (realStart ? 0 : GUESSED_START_LAG_MS));
      if (e.charIndex >= 8 && since > 500) {
        const local = spokenLength(part.slice(0, e.charIndex)) / (since / 1000);
        pace = Math.min(pace * 2, Math.max(pace / 2, (pace + local) / 2));
      }
      heard = true;
      anchor = { at: e.charIndex, time: now };
      // 估計已經亮到前面一點、真的回報才剛到：別往回閃（亂跳），維持目前亮的字；落後太多（超過約兩個字）才真的退回來對齊。
      if (e.charIndex < lit && lit - e.charIndex <= 12) return;
      lit = e.charIndex;
      setProgress({ sentence, word: [start + e.charIndex, start + wordEnd(part, e.charIndex, e.charLength)] });
    };
    u.lang = voice?.lang ?? VOICE_LANG[language];
    if (voice) u.voice = voice;
    u.rate = rate;
    u.volume = 1;
    return u;
  });
  const first = queue[0];
  if (!first) return "ok";
  const mine = queue;
  return new Promise<SpeakResult>((resolve) => {
    let started = false;
    const watchdog = setTimeout(() => {
      // 有些 Android 不發 onstart，但 speaking 會是 true。
      if (started || synth.speaking || queue !== mine) return resolve("ok");
      reportProblem(
        voices.length
          ? `朗讀沒有開始（語音：${voice?.name ?? "預設"}）。請確認喇叭或耳機音量、手機不是靜音模式、分頁沒有被靜音，再點一次。`
          : noVoiceHelp(language),
      );
      resolve("silent");
    }, 3000);
    const progressStart = first.onstart;
    first.onstart = (e) => {
      progressStart?.call(first, e);
      started = true;
      clearTimeout(watchdog);
      resolve("ok");
    };
    first.onerror = (e) => {
      clearTimeout(watchdog);
      if (e.error === "canceled" || e.error === "interrupted") return resolve("ok");
      // 語音本身壞掉（synthesis-failed 等）：記下這個語音，自動換別的語音重唸一次，不讓使用者看到錯誤。
      if (RETRY_ERRORS.has(e.error) && voice && queue === mine) {
        failedVoices.add(voice.name);
        return resolve(speak(input, language, speed, onProgress, from, one));
      }
      reportProblem(`${friendlySpeechError(e.error)}${isLinuxDesktop() ? LINUX_HELP : ""}`);
      resolve("error");
    };
    const last = mine[mine.length - 1];
    const ended = () => {
      if (queue !== mine) return;
      setSpeaking("idle");
      setProgress(null);
    };
    last.addEventListener("end", ended);
    last.addEventListener("error", ended);
    setSpeaking("speaking");
    // 先標出要唸的這一句，就算語音沒回報 onstart，標示也會跟著移過去。
    setProgress({ sentence: [parts[0].sentenceStart, parts[0].start + parts[0].text.length] });
    const run = () => {
      if (queue !== mine) return;
      for (const u of mine) synth.speak(u);
    };
    if (interrupted) setTimeout(run, CANCEL_GAP_MS);
    else run();
    // 保底：唸了一陣子還沒收到 onstart，就當作已經開始，讓亮燈照估計往前走。
    setTimeout(() => {
      if (queue === mine && synth.speaking) starters.get(first)?.(false);
    }, (interrupted ? CANCEL_GAP_MS : 0) + START_FALLBACK_MS);
  });
}

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}

type RecognitionCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: (e: { resultIndex: number; results: ArrayLike<RecognitionResult> }) => void;
  onerror: (e: { error: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};

function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as Record<string, RecognitionCtor | undefined>;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function canListen(): boolean {
  return Boolean(recognitionCtor());
}

export function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

/** 能不能錄音（交給 Gemini 評分）；不支援語音辨識的瀏覽器也可能可以錄。 */
export function canRecord(): boolean {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

/** 辨識結果：只把定案的段落接起來，最後一段還沒定案就用暫定的。 */
export function joinTranscripts(results: ArrayLike<RecognitionResult>): string {
  const parts: string[] = [];
  for (let i = 0; i < results.length; i++) parts.push(results[i][0].transcript.trim());
  return parts.filter(Boolean).join(" ");
}

/** 辨識錯誤翻成看得懂的話；no-speech、aborted 只是沒聽到或被停掉，不算錯，錄音照樣送去評分。 */
export function recognitionProblem(error: string): string | undefined {
  if (error === "no-speech" || error === "aborted") return undefined;
  if (error === "not-allowed" || error === "service-not-allowed") return "瀏覽器不讓網頁用語音辨識，請在網址列左側的設定允許麥克風";
  if (error === "audio-capture") return "瀏覽器抓不到麥克風，請確認麥克風有接好、沒被其他程式占用";
  if (error === "network") return "語音辨識要連網，網路不穩時只能靠錄音評分";
  return `語音辨識出錯（${error}）`;
}

/** 麥克風開不起來時的說明。 */
export function microphoneProblem(e: unknown): string {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "麥克風權限被擋住了：點網址列左側的圖示，把麥克風改成「允許」後重新整理";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "找不到麥克風，請接上麥克風或耳機";
  if (name === "NotReadableError") return "麥克風被其他程式占用（例如視訊會議），請先關掉再試";
  return e instanceof Error ? e.message : String(e);
}

/** 錄音音量低於這個值（RMS）就當作麥克風沒收到聲音。 */
export const SILENT_PEAK = 0.005;

/**
 * 跟讀比對：把標點與大小寫去掉後，算目標字裡有幾成被唸到。
 * 日語辨識常回傳漢字，所以可以給多種寫法（假名、漢字），取最高分。
 */
export function shadowingScore(target: string | string[], heard: string, language: Language): number {
  if (Array.isArray(target)) return Math.max(0, ...target.map((t) => shadowingScore(t, heard, language)));
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[\p{P}\p{S}]/gu, "")
      .trim();
  // 照順序比對（最長共同子序列），多唸、漏唸、順序亂掉都會扣分，不只是「有沒有出現過這個字」。
  const t = language === "ja" ? [...norm(target).replace(/\s/g, "")] : norm(target).split(/\s+/).filter(Boolean);
  const h = language === "ja" ? [...norm(heard).replace(/\s/g, "")] : norm(heard).split(/\s+/).filter(Boolean);
  if (!t.length) return 0;
  return lcs(t, h) / Math.max(t.length, h.length);
}

function lcs(a: string[], b: string[]): number {
  let prev = new Array(b.length + 1).fill(0);
  for (const x of a) {
    const row = [0];
    b.forEach((y, j) => row.push(x === y ? prev[j] + 1 : Math.max(prev[j + 1], row[j])));
    prev = row;
  }
  return prev[b.length];
}

export interface Recording {
  /** 瀏覽器辨識到的文字（Gemini 不能用時拿來評分）。 */
  heard: string;
  /** 錄音，base64，沒有麥克風錄音功能時為空。 */
  audio: string;
  mimeType: string;
  /** 錄音期間最大音量（RMS，0–1），拿來判斷麥克風有沒有收到聲音；-1 表示量不到。 */
  peak: number;
  /** 實際用到的麥克風名稱。 */
  device: string;
  /** 語音辨識的問題說明（沒有就是正常）。 */
  problem?: string;
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export interface RecordingSession {
  /** 麥克風名稱，開始錄音時就知道。 */
  device: string;
  /** 唸完了：停止錄音與辨識。 */
  stop: () => void;
  /** 停止後拿到錄音與辨識結果。 */
  done: Promise<Recording>;
}

/**
 * 開始跟讀：一邊錄音給 Gemini，一邊用瀏覽器連續辨識，直到按「唸完了」或到時間上限。
 * 辨識沒聽到字（no-speech）不會中斷，錄音照樣保留；onLevel 會一直回報音量給畫面上的音量條。
 */
let aiDownUntil = 0;

/** AI 評分失敗後 10 分鐘內，手機改用瀏覽器語音辨識（Android 不能同時錄音和辨識）。 */
export function markAiUnavailable(ms = 10 * 60 * 1000) {
  aiDownUntil = Date.now() + ms;
}

export function aiUnavailable(): boolean {
  return Date.now() < aiDownUntil;
}

export async function startRecording(
  language: Language,
  { onLevel, maxMs = 20000 }: { onLevel?: (level: number) => void; maxMs?: number } = {},
): Promise<RecordingSession> {
  stopSpeaking();
  // 音量偵測用的 AudioContext 要在點擊當下建立：等完麥克風權限才建，Chrome 會讓它停在 suspended，量到的音量永遠是 0。
  let ctx: AudioContext | null = typeof AudioContext !== "undefined" ? new AudioContext() : null;
  let stream: MediaStream | null = null;
  const listenOnly = isAndroid() && canListen() && aiUnavailable();
  if (canRecord() && !listenOnly) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (e) {
      await ctx?.close().catch(() => {});
      throw new Error(microphoneProblem(e));
    }
  }
  const device = stream?.getAudioTracks()[0]?.label ?? "";

  // 錄音
  const chunks: Blob[] = [];
  const recorder = stream ? new MediaRecorder(stream) : null;
  if (recorder) {
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.start();
  }

  // 音量（量不到時 peak 是 -1，代表不知道，不能拿來判斷沒聲音）
  let peak = -1;
  let raf = 0;
  if (ctx && ctx.state !== "running") await ctx.resume().catch(() => {});
  if (ctx && ctx.state !== "running") {
    await ctx.close().catch(() => {});
    ctx = null;
  }
  if (stream && ctx) {
    peak = 0;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      const rms = Math.sqrt(sum / buf.length);
      peak = Math.max(peak, rms);
      onLevel?.(Math.min(1, rms * 5));
      raf = requestAnimationFrame(tick);
    };
    tick();
  }

  // 辨識
  let heard = "";
  let problem: string | undefined;
  let recognitionEnded: Promise<void> = Promise.resolve();
  // Android 的麥克風同一時間只給一個人用：錄音和語音辨識一起開，兩邊都可能收不到聲音（一直 no-speech）。
  // 手機上有錄音就只錄音，交給 Gemini 評分（它會回傳聽到的內容）。
  const Ctor = stream && isAndroid() ? undefined : recognitionCtor();
  const r = Ctor ? new Ctor() : null;
  if (r) {
    r.lang = VOICE_LANG[language];
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      heard = joinTranscripts(e.results);
    };
    r.onerror = (e) => {
      problem = recognitionProblem(e.error) ?? problem;
    };
    recognitionEnded = new Promise((resolve) => {
      r.onend = () => resolve();
    });
    try {
      r.start();
    } catch {
      // 已經在跑或瀏覽器不肯開，就只靠錄音。
    }
  }

  let stopNow: () => void = () => {};
  const stopped = new Promise<void>((resolve) => {
    stopNow = resolve;
  });
  const cap = setTimeout(stopNow, maxMs);

  const done = (async (): Promise<Recording> => {
    await stopped;
    clearTimeout(cap);
    try {
      r?.stop();
    } catch {
      // 早就停了
    }
    // 辨識停下來要一點時間才會給最後結果，最多等 1.5 秒。
    await Promise.race([recognitionEnded, new Promise((ok) => setTimeout(ok, 1500))]);
    if (recorder && recorder.state !== "inactive") {
      await new Promise<void>((ok) => {
        recorder.onstop = () => ok();
        recorder.stop();
      });
    }
    cancelAnimationFrame(raf);
    onLevel?.(0);
    stream?.getTracks().forEach((t) => t.stop());
    await ctx?.close().catch(() => {});
    const blob = new Blob(chunks, { type: recorder?.mimeType || "audio/webm" });
    return {
      heard,
      audio: chunks.length ? await toBase64(blob) : "",
      mimeType: blob.type,
      peak,
      device,
      problem,
    };
  })();

  return { device, stop: () => stopNow(), done };
}
