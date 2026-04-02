// /app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { LangProvider } from "@/components/site/LangProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HOPY",
  description: "Design your inner system.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // ✅ ここで cookies() は使わない（Next 16.1.6 の async dynamic api による 500 回避）
  // ✅ 言語の初期一致（SSR/CSR完全一致）は次ステップで別手段（middleware 等）でやる
  return (
    <html lang="en" className="hopyHtml">
      <body className={`hopyBody ${geistSans.variable} ${geistMono.variable}`}>
        <LangProvider>
          {/* ✅ ここを “viewport固定レイヤ” にして、windowスクロールを殺す土台にする */}
          <div className="hopyApp">{children}</div>
        </LangProvider>
      </body>
    </html>
  );
}