// /app/api/chat/_lib/route/authenticatedErrorPayload.ts

import { detectDbKind } from "../supabase/dbError";
import { errorText } from "../infra/text";

export function buildDbErrorPayload(params: {
  error: unknown;
  debugSave: boolean;
  enforceThreadOwnership: boolean;
  fkError: string;
  saveError: string;
}): { status: number; payload: any } {
  const { error, debugSave, enforceThreadOwnership, fkError, saveError } =
    params;

  const kind = detectDbKind(error);

  if (kind === "fk_violation") {
    const payload: any = { ok: false, error: fkError };
    if (debugSave) payload.detail = errorText(error);
    return { status: 409, payload };
  }

  if (kind === "rls_denied") {
    const payload: any = {
      ok: false,
      error: enforceThreadOwnership ? "thread_forbidden" : "db_forbidden",
    };
    if (debugSave) payload.detail = errorText(error);
    return { status: 403, payload };
  }

  const payload: any = { ok: false, error: saveError };
  if (debugSave) payload.detail = errorText(error);
  return { status: 500, payload };
}