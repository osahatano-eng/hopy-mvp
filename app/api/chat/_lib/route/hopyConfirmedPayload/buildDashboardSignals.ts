// /app/api/chat/_lib/route/hopyConfirmedPayload/buildDashboardSignals.ts

export type HopyDashboardSignal = {
  type: string;
  [key: string]: unknown;
};

type BuildDashboardSignalsParams = {
  dashboardSignal: unknown;
  supportFocusSignal: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}

function normalizeSignalType(
  value: Record<string, unknown>,
  fallback: string,
): HopyDashboardSignal {
  const rawType = String(value.type ?? "").trim();
  const type = rawType || fallback;

  return {
    ...value,
    type,
  };
}

function normalizeDashboardSignal(
  value: unknown,
  fallback: string,
): HopyDashboardSignal | null {
  if (!isRecord(value)) return null;
  if (!hasKeys(value)) return null;
  return normalizeSignalType(value, fallback);
}

export function buildDashboardSignals(
  params: BuildDashboardSignalsParams,
): HopyDashboardSignal[] {
  const normalizedDashboardSignal = normalizeDashboardSignal(
    params.dashboardSignal,
    "dashboard_signal",
  );
  const normalizedSupportFocusSignal = normalizeDashboardSignal(
    params.supportFocusSignal,
    "support_focus_signal",
  );

  return [
    normalizedDashboardSignal,
    normalizedSupportFocusSignal,
  ].filter((signal): signal is HopyDashboardSignal => signal !== null);
}