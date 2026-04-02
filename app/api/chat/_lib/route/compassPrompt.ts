// /app/api/chat/_lib/route/compassPrompt.ts

import type { CanonicalAssistantState } from "./authenticatedTypes";
import { buildCompassPromptInput } from "./compassPromptInput";

export function buildCompassPrompt(
  assistantState: CanonicalAssistantState,
): string {
  const compass = buildCompassPromptInput(assistantState);

  if (!compass.eligible) {
    return "";
  }

  const phaseLine = `current_phase=${compass.current_phase}`;
  const stateLine = `state_level=${compass.state_level}`;
  const prevPhaseLine = `prev_phase=${compass.prev_phase}`;
  const prevStateLine = `prev_state_level=${compass.prev_state_level}`;

  return [
    "HOPY Compass generation target detected.",
    "Generate Compass only from the confirmed meaning payload.",
    "Do not reinterpret the raw user message independently.",
    phaseLine,
    stateLine,
    prevPhaseLine,
    prevStateLine,
  ].join("\n");
}