// /app/api/chat/_lib/supabase/dbError.ts
import { errorText } from "../infra/text";

export type DbKind = "fk_violation" | "rls_denied" | "not_found" | "unknown";

export function detectDbKind(e: any): DbKind {
  const msg = errorText(e).toLowerCase();
  const code = String((e as any)?.code ?? "").trim(); // Postgres code (if any)

  // FK: 23503
  if (code === "23503") return "fk_violation";
  if (msg.includes("foreign key")) return "fk_violation";
  if (msg.includes("violates foreign key")) return "fk_violation";

  // RLS/permission
  if (msg.includes("row-level security")) return "rls_denied";
  if (msg.includes("permission denied")) return "rls_denied";
  if (code === "42501") return "rls_denied";

  // Not found-ish
  if (code === "pgrst116") return "not_found"; // PostgREST: results contain 0 rows (single)
  if (msg.includes("no rows")) return "not_found";

  return "unknown";
}