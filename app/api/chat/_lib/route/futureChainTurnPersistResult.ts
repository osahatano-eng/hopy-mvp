// /app/api/chat/_lib/route/futureChainTurnPersistResult.ts

export type FutureChainTurnPersistDecision = "save" | "skip";

export type FutureChainTurnPersistResult = {
  ok: boolean;
  decision: FutureChainTurnPersistDecision;
  reason: string | null;
  patternId: string | null;
};

const EMPTY_FUTURE_CHAIN_TURN_PERSIST_RESULT: FutureChainTurnPersistResult = {
  ok: false,
  decision: "skip",
  reason: null,
  patternId: null,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeOptionalBoolean(value: unknown): boolean | null {
  if (typeof value !== "boolean") return value;
  return value;
}

function resolveDecision(
  value: unknown,
): FutureChainTurnPersistDecision | null {
  if (value !== "save" && value !== "skip") {
    return null;
  }
  return value;
}

function resolvePatternId(
  record: Record<string, unknown>,
): string | null {
  return (
    normalizeOptionalText(record.patternId) ??
    normalizeOptionalText(record.pattern_id) ??
    null
  );
}

function resolveReason(
  record: Record<string, unknown>,
): string | null {
  return normalizeOptionalText(record.reason);
}

function resolveOk(
  record: Record<string, unknown>,
  decision: FutureChainTurnPersistDecision,
): boolean {
  const explicitOk = normalizeOptionalBoolean(record.ok);
  if (explicitOk !== null) {
    return explicitOk;
  }

  return decision === "save";
}

export function buildFutureChainTurnPersistResult(
  value: unknown,
): FutureChainTurnPersistResult {
  const record = asRecord(value);
  if (!record) {
    return EMPTY_FUTURE_CHAIN_TURN_PERSIST_RESULT;
  }

  const decision = resolveDecision(record.decision);
  if (!decision) {
    return EMPTY_FUTURE_CHAIN_TURN_PERSIST_RESULT;
  }

  return {
    ok: resolveOk(record, decision),
    decision,
    reason: resolveReason(record),
    patternId: resolvePatternId(record),
  };
}

export function buildSkippedFutureChainTurnPersistResult(
  reason: string | null,
): FutureChainTurnPersistResult {
  return {
    ok: false,
    decision: "skip",
    reason: normalizeOptionalText(reason),
    patternId: null,
  };
}

/*
【このファイルの正式役割】
Future Chain 保存処理の戻り値を、route 層で UI へ渡しやすい最小結果へ正規化するだけの中継ファイル。

このファイルは save / skip / reason / patternId / ok を整えるだけを担当する。
Future Chain の保存前チェック、状態再判定、DB insert、UI文言決定は担当しない。

【今回このファイルで修正したこと】
- Future Chain 保存結果の最小中継型 FutureChainTurnPersistResult を新規定義した。
- saveFutureChainFromConfirmedPayload(...) の戻り値を unknown のまま受け取り、decision / reason / patternId / ok だけへ正規化する buildFutureChainTurnPersistResult(...) を追加した。
- 例外時や握りつぶし時に使える skip 固定の buildSkippedFutureChainTurnPersistResult(...) を追加した。
- このファイルでは hopy_confirmed_payload、state_changed、state_level、current_phase、Compass を再判定していない。
- このファイルでは DB 保存処理や UI 表示文言を持たせていない。

/app/api/chat/_lib/route/futureChainTurnPersistResult.ts
*/