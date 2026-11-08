import type { Metadata, Viewport } from "next";
import { AdminLink, AuthGate, BoardLink, DemoRoleSwitcher, FamilyLink, HomeLink, SignOutButton } from "@/components/AuthGate";
import { SpeechNotice } from "@/components/SpeechNotice";
import { THEME_SCRIPT, ThemeToggle } from "@/components/ThemeToggle";
import { VoiceMenu } from "@/components/VoiceMenu";
import "./globals.css";
import { Toaster } from "@/components/Toast";

export const metadata: Metadata = {
  title: "全家多語化",
  description: "全家一起學英語與日語：分級、練習、進度與獎勵",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // 主題在畫面出來前由 THEME_SCRIPT 設好，伺服器產生的 class 會和它不同，所以忽略這個差異。
    <html lang="zh-Hant" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <Toaster />
        <header className="border-b border-black/10 dark:border-white/10">
          <nav className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2">
            <HomeLink />
            <span className="flex items-center">
              <BoardLink />
              <FamilyLink />
              <ThemeToggle />
              <VoiceMenu />
              <AdminLink />
              <SignOutButton />
            </span>
          </nav>
        </header>
        <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
          <DemoRoleSwitcher />
          <SpeechNotice />
          <AuthGate>{children}</AuthGate>
        </main>
      </body>
    </html>
  );
}
