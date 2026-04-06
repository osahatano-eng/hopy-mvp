// /app/layout.tsx
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { LangProvider } from "@/components/site/LangProvider";
import PwaUpdateBridge from "@/components/pwa/PwaUpdateBridge";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

type HopyMetadataCopy = {
  title: string;
  description: string;
  htmlLang: "ja" | "en";
};

function resolvePreferredLangFromAcceptLanguage(
  acceptLanguage: string | null,
): "ja" | "en" {
  const normalized = String(acceptLanguage ?? "").toLowerCase();

  if (normalized.includes("ja")) {
    return "ja";
  }

  return "en";
}

function getHopyMetadataCopy(lang: "ja" | "en"): HopyMetadataCopy {
  if (lang === "ja") {
    return {
      title: "HOPY | 思考に静かに寄り添うAI",
      description:
        "HOPYは、考えを整理し、自分でも気づいていない傾向に気づき、次の一歩を見つけるためのAIです。",
      htmlLang: "ja",
    };
  }

  return {
    title: "HOPY | Your Calm Thinking Companion",
    description:
      "HOPY helps you organize your thoughts, notice hidden patterns, and find your next step with calm, thoughtful AI support.",
    htmlLang: "en",
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const headerStore = await headers();
  const preferredLang = resolvePreferredLangFromAcceptLanguage(
    headerStore.get("accept-language"),
  );
  const copy = getHopyMetadataCopy(preferredLang);

  return {
    title: copy.title,
    description: copy.description,
    icons: {
      icon: "/brand/hopy-icon-master.svg?v=2",
      shortcut: "/brand/hopy-icon-master.svg?v=2",
      apple: "/icon.png?v=2",
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerStore = await headers();
  const preferredLang = resolvePreferredLangFromAcceptLanguage(
    headerStore.get("accept-language"),
  );
  const copy = getHopyMetadataCopy(preferredLang);

  return (
    <html lang={copy.htmlLang} className="hopyHtml">
      <body className={`hopyBody ${geistSans.variable} ${geistMono.variable}`}>
        <LangProvider>
          <div className="hopyApp">{children}</div>
          <PwaUpdateBridge />
        </LangProvider>
      </body>
    </html>
  );
}

/*
このファイルの正式役割:
アプリ全体の最上位レイアウトとして、グローバルCSS・フォント・LangProvider・html/bodyの基盤を定義し、
head metadata と html lang を全体へ適用するための唯一の親レイヤです。
*/

/*
【今回このファイルで修正したこと】
1. PwaUpdateBridge を import しました。
2. RootLayout の LangProvider 配下に PwaUpdateBridge を1回だけ配置しました。
3. これにより、PWA更新検知UIを全体へ接続しました。
4. metadata、LangProvider、html/body基盤、HOPY唯一の正に関わる既存ロジックは変更していません。
*/

/*
このファイルのフルパス:
/app/layout.tsx
*/