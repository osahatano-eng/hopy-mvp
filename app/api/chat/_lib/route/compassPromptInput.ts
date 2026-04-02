// /app/api/chat/_lib/route/compassPromptInput.ts

import type {
  CanonicalAssistantState,
  CompassPayload,
} from "./authenticatedTypes";
import { buildCompassPayload } from "./compassPayload";

export function buildCompassPromptInput(
  assistantState: CanonicalAssistantState,
): CompassPayload {
  return buildCompassPayload(assistantState);
}