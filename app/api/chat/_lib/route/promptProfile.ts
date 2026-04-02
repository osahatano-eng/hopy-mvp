// /app/api/chat/_lib/route/promptProfile.ts

export type PromptVariant = "short" | "medium" | "full";
export type MemoryMode = "off" | "plus" | "pro";
export type LearningMode = "off" | "pro";
export type ReplyLengthMode = "free" | "plus" | "pro";

export type PromptProfile = {
  replyLanguageLock: "full";
  personaVariant: PromptVariant;
  continuityVariant: PromptVariant;
  styleVariant: PromptVariant;
  antiPlatitudeVariant: PromptVariant;
  complianceVariant: PromptVariant;
  coreVariant: PromptVariant;
  userPromptVariant: PromptVariant;
  memoryMode: MemoryMode;
  learningMode: LearningMode;
  replyLengthMode: ReplyLengthMode;
};

export type ResolvedPlan = "free" | "plus" | "pro";

function createPromptProfile(args: {
  sharedVariant: PromptVariant;
  coreVariant?: PromptVariant;
  complianceVariant?: PromptVariant;
  memoryMode: MemoryMode;
  learningMode: LearningMode;
  replyLengthMode: ReplyLengthMode;
}): PromptProfile {
  return {
    replyLanguageLock: "full",
    personaVariant: args.sharedVariant,
    continuityVariant: args.sharedVariant,
    styleVariant: args.sharedVariant,
    antiPlatitudeVariant: args.sharedVariant,
    complianceVariant: args.complianceVariant ?? args.sharedVariant,
    coreVariant: args.coreVariant ?? args.sharedVariant,
    userPromptVariant: args.sharedVariant,
    memoryMode: args.memoryMode,
    learningMode: args.learningMode,
    replyLengthMode: args.replyLengthMode,
  };
}

const FREE_PROMPT_PROFILE = createPromptProfile({
  sharedVariant: "short",
  coreVariant: "short",
  memoryMode: "off",
  learningMode: "off",
  replyLengthMode: "free",
});

const PLUS_PROMPT_PROFILE = createPromptProfile({
  sharedVariant: "medium",
  complianceVariant: "full",
  memoryMode: "plus",
  learningMode: "off",
  replyLengthMode: "plus",
});

const PRO_PROMPT_PROFILE = createPromptProfile({
  sharedVariant: "full",
  memoryMode: "pro",
  learningMode: "pro",
  replyLengthMode: "pro",
});

const PROMPT_PROFILES: Record<ResolvedPlan, PromptProfile> = {
  free: FREE_PROMPT_PROFILE,
  plus: PLUS_PROMPT_PROFILE,
  pro: PRO_PROMPT_PROFILE,
};

export function buildPromptProfile(
  resolvedPlan: ResolvedPlan,
): PromptProfile {
  return PROMPT_PROFILES[resolvedPlan];
}