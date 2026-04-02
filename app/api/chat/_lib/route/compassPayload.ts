// /app/api/chat/_lib/route/compassPayload.ts

import type {
  CanonicalAssistantState,
  CompassPayload,
} from "./authenticatedTypes";

export function buildCompassPayload(
  assistantState: CanonicalAssistantState,
): CompassPayload {
  const {
    state_level,
    current_phase,
    state_changed,
    prev_phase,
    prev_state_level,
  } = assistantState;

  return {
    eligible: state_changed === true,
    state_changed,
    state_level,
    current_phase,
    prev_phase,
    prev_state_level,
  };
}