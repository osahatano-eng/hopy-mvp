// /app/chat/page.tsx
import ChatClient from "@/components/chat/ChatClient";

/**
 * /chat は「思考の空間」
 * - ヘッダーは site共通 TopHeader を唯一のヘッダーとして layout.tsx で描画
 * - 本体は ChatClient のみ（1カラム）
 *
 * ✅ Mobile含め「入口の揺れ」を潰すために
 * - 静的化/キャッシュを強制的に避ける
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function Page() {
  return <ChatClient />;
}