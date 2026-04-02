// /app/api/chat/_lib/hopy/prompt/hopyOutputSchema.ts

export type HopyOutputStateCandidate = {
  state_level: 1 | 2 | 3 | 4 | 5;
  current_phase: 1 | 2 | 3 | 4 | 5;
};

export type HopyOutputMemoryCandidateRaw = {
  body: string;
  memory_type: "trait" | "theme" | "support_context" | "dashboard_signal";
};

export type HopyOutputDashboardSignalRaw = {
  signal_type: string;
  signal_value: string;
};

export type HopyOutputExpressionCandidateRaw = {
  expression: string;
  normalized_expression?: string;
  meaning_category?: string;
  tone?: string;
};

export type HopyOutputShape = {
  reply: string;
  state: HopyOutputStateCandidate;
  memoryCandidates: HopyOutputMemoryCandidateRaw[];
  dashboardSignals: HopyOutputDashboardSignalRaw[];
  expressionCandidates: HopyOutputExpressionCandidateRaw[];
  titleCandidate?: string;
};

export function getHopyOutputSchema(): string {
  return [
    "{",
    '  "reply": "string",',
    '  "state": {',
    '    "state_level": 1,',
    '    "current_phase": 1',
    "  },",
    '  "memoryCandidates": [',
    "    {",
    '      "body": "string",',
    '      "memory_type": "trait | theme | support_context | dashboard_signal"',
    "    }",
    "  ],",
    '  "dashboardSignals": [',
    "    {",
    '      "signal_type": "string",',
    '      "signal_value": "string"',
    "    }",
    "  ],",
    '  "expressionCandidates": [',
    "    {",
    '      "expression": "string",',
    '      "normalized_expression": "string",',
    '      "meaning_category": "string",',
    '      "tone": "string"',
    "    }",
    "  ],",
    '  "titleCandidate": "string"',
    "}",
  ].join("\n");
}

export default getHopyOutputSchema;