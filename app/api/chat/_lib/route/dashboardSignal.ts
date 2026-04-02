// /app/api/chat/_lib/route/dashboardSignal.ts

export type DashboardSignalType =
  | "state_snapshot"
  | "state_transition"
  | "support_focus";

export type DashboardSignalPayload = {
  type: DashboardSignalType;
  state_level: 1 | 2 | 3 | 4 | 5;
  current_phase: 1 | 2 | 3 | 4 | 5;
  state_changed: boolean;
  prev_phase: 1 | 2 | 3 | 4 | 5 | null;
  prev_state_level: 1 | 2 | 3 | 4 | 5 | null;
  label: "混線" | "模索" | "整理" | "収束" | "決定";
  summary: string;
  source: "assistant_confirmed_result";
};

export type BuildDashboardSignalArgs = {
  assistantText: string;
  currentPhase?: number | null;
  stateLevel?: number | null;
  stateChanged?: boolean | null;
  prevPhase?: number | null;
  prevStateLevel?: number | null;
};

function normalizeStateLevel(value: unknown): 1 | 2 | 3 | 4 | 5 {
  const n = Number(value);
  if (Number.isInteger(n) && n >= 1 && n <= 5) {
    return n as 1 | 2 | 3 | 4 | 5;
  }
  return 1;
}

function normalizePrevStateLevel(value: unknown): 1 | 2 | 3 | 4 | 5 | null {
  const n = Number(value);
  if (Number.isInteger(n) && n >= 1 && n <= 5) {
    return n as 1 | 2 | 3 | 4 | 5;
  }
  return null;
}

function normalizeBoolean(value: unknown): boolean {
  return value === true;
}

function stateLabel(stateLevel: 1 | 2 | 3 | 4 | 5): "混線" | "模索" | "整理" | "収束" | "決定" {
  switch (stateLevel) {
    case 1:
      return "混線";
    case 2:
      return "模索";
    case 3:
      return "整理";
    case 4:
      return "収束";
    case 5:
      return "決定";
    default:
      return "混線";
  }
}

function normalizeSummary(text: string): string {
  const oneLine = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!oneLine) return "";

  return oneLine.length > 160 ? oneLine.slice(0, 160).trim() : oneLine;
}

export function buildDashboardSignal(
  args: BuildDashboardSignalArgs,
): DashboardSignalPayload {
  const currentPhase = normalizeStateLevel(args.currentPhase);
  const stateLevel = normalizeStateLevel(args.stateLevel);
  const stateChanged = normalizeBoolean(args.stateChanged);
  const prevPhase = normalizePrevStateLevel(args.prevPhase);
  const prevStateLevel = normalizePrevStateLevel(args.prevStateLevel);
  const summary = normalizeSummary(args.assistantText);

  return {
    type: stateChanged ? "state_transition" : "state_snapshot",
    state_level: stateLevel,
    current_phase: currentPhase,
    state_changed: stateChanged,
    prev_phase: prevPhase,
    prev_state_level: prevStateLevel,
    label: stateLabel(stateLevel),
    summary,
    source: "assistant_confirmed_result",
  };
}

export function buildSupportFocusSignal(
  args: BuildDashboardSignalArgs,
): DashboardSignalPayload | null {
  const stateLevel = normalizeStateLevel(args.stateLevel);
  const currentPhase = normalizeStateLevel(args.currentPhase);
  const stateChanged = normalizeBoolean(args.stateChanged);
  const prevPhase = normalizePrevStateLevel(args.prevPhase);
  const prevStateLevel = normalizePrevStateLevel(args.prevStateLevel);
  const summary = normalizeSummary(args.assistantText);

  if (!summary) return null;

  return {
    type: "support_focus",
    state_level: stateLevel,
    current_phase: currentPhase,
    state_changed: stateChanged,
    prev_phase: prevPhase,
    prev_state_level: prevStateLevel,
    label: stateLabel(stateLevel),
    summary,
    source: "assistant_confirmed_result",
  };
}