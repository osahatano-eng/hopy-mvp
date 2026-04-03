// /app/manifest.ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "HOPY AI",
    short_name: "HOPY",
    description: "内なるOSを設計する。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

/*
このファイルの正式役割
PWA manifest の基本情報と、ホーム画面追加・インストール時に使うアイコン定義を返すファイル
*/

/*
【今回このファイルで修正したこと】
古い /icons/icon-192.png / icon-512.png / maskable-*.png 参照をやめて、
現在の favicon 系で使う /icon.png を PWA icons に統一しました。
*/