import type { ChoiceDefinition, GenerationMode, SessionResult } from "./types";

export type SessionScoringInput = {
  sessionId: string;
  scenarioId: string;
  initialChoice: ChoiceDefinition;
  transferChoice: ChoiceDefinition;
  generationMode: GenerationMode;
  generationValidated: boolean;
  startedAt: string;
  completedAt: string;
};

export function scoreSession(input: SessionScoringInput): SessionResult {
  const transferSuccessful = input.transferChoice.safetyClass === "safe";
  const improved = input.initialChoice.safetyClass !== "safe" && transferSuccessful;
  const scoreEligible = input.generationMode === "live" && input.generationValidated;

  return {
    sessionId: input.sessionId,
    scenarioId: input.scenarioId,
    initialDecisionId: input.initialChoice.id,
    initialSafetyClass: input.initialChoice.safetyClass,
    transferDecisionId: input.transferChoice.id,
    transferSuccessful,
    improved,
    generationMode: input.generationMode,
    generationValidated: input.generationValidated,
    scoreEligible,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
  };
}
