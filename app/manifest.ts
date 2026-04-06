// /app/manifest.ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "HOPY",
    short_name: "HOPY",
    description: "思考に静かに寄り添うAI",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    orientation: "portrait",
    icons: [
      {
        src: "/brand/hopy-icon-master.svg?v=2",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.png?v=2",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png?v=2",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png?v=2",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon.png?v=2",
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
1. PWA icons の /brand/hopy-icon-master.svg に version query を付けました。
2. 既存の /icon.png にも version query を付け、ホーム画面追加時の古いキャッシュが残りにくいようにしました。
3. 参照ファイル自体は増やさず、存在しない新規PNGへは切り替えていません。
*/