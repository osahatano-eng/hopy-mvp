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
        src: "/brand/hopy-icon-master.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
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
1. PWA icons の先頭に、親ソースである /brand/hopy-icon-master.svg を追加しました。
2. 既存の /icon.png は、fallback 用の PNG として残しました。
3. まだ PWA 専用の 192 / 512 / maskable PNG を新規作成していないため、このファイルでは参照先の土台だけを整えました。
*/