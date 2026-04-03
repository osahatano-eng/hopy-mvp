// /app/layout.tsx
import type { Metadata } from "next";
import { headers } from "next/headers";
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
      icon: "/brand/hopy-icon-master.svg",
      shortcut: "/brand/hopy-icon-master.svg",
      apple: "/icon.png",
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

  // ✅ cookies() は使わない
  // ✅ title / description / html lang は Accept-Language をもとに最小限で出し分ける
  return (
    <html lang={copy.htmlLang} className="hopyHtml">
      <body className={`hopyBody ${geistSans.variable} ${geistMono.variable}`}>
        <LangProvider>
          <div className="hopyApp">{children}</div>
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
1. metadata icons の参照先を /icon.svg から /brand/hopy-icon-master.svg に変更しました。
2. shortcut icon も同じく /brand/hopy-icon-master.svg にそろえました。
3. apple icon は現時点で既存の /icon.png を維持しました。
*/

/*
このファイルの正式役割
アプリ全体のhead metadataとhtml/body基盤を定義し、ブラウザやホーム画面で使うアイコン参照を返す最上位レイアウトファイル
*/

/*
【今回このファイルで修正したこと】
metadata icons の参照先を正式親ソース /brand/hopy-icon-master.svg へ変更し、
shortcut icon も同じ参照先へ統一しました。
apple icon は未作成の正式専用画像へ勝手に切り替えず、既存の /icon.png のまま維持しました。
*/