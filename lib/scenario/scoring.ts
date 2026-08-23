import type { ChoiceDefinition, GenerationMode, SessionResult } from "./types";
import type { SimulationState } from "@/lib/player/simulation-reducer";

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

export type ReadinessAssessment = {
  cueRecognition: number;
  actionSequence: number;
  hazardExposure: number;
  resourceUse: number;
  responseTime: number;
  hintIndependence: number;
  transferSuccessful: boolean;
  improved: boolean;
  scoreEligible: boolean;
  overall: number;
  summary: string;
};

export function scoreSimulation(primary: SimulationState, transfer: SimulationState, generationValidated: boolean): ReadinessAssessment {
  const primaryWorld = primary.world;
  const primaryActions = primary.eventLog.filter((event) => event.kind === "action");
  const transferActions = transfer.eventLog.filter((event) => event.kind === "action");
  const initialUnsafe = primaryActions.some((event) => event.safetyClass === "unsafe");
  const transferSuccessful = transferActions.some((event) => event.safetyClass === "safe");
  const improved = initialUnsafe && transferSuccessful;
  const safeActions = primaryActions.filter((event) => event.safetyClass === "safe").length;
  const unsafeActions = primaryActions.filter((event) => event.safetyClass === "unsafe").length;
  const cueRecognition = primaryWorld ? Math.min(100, primaryWorld.discoveredCueIds.length * 50) : 0;
  const actionSequence = primaryActions.length === 0 ? 0 : Math.round((safeActions / primaryActions.length) * 100);
  const hazardExposure = primaryWorld ? Math.max(0, 100 - Object.values(primaryWorld.hazardLevels).reduce((total, value) => total + value * 10, 0)) : 0;
  const resourceUse = primaryWorld && primaryWorld.availableResources.length > 0 ? 70 : 40;
  const responseTime = 70;
  const hintIndependence = primaryWorld ? Math.max(0, 100 - primaryWorld.hintsUsed * 20) : 0;
  const overall = Math.round((cueRecognition + actionSequence + hazardExposure + resourceUse + responseTime + hintIndependence) / 6);
  const scoreEligible = generationValidated;
  const summary = improved
    ? "Your second decision was safer after seeing the consequence."
    : transferSuccessful
      ? "You carried the safety principle into the transfer scenario."
      : unsafeActions > 0
        ? "The transfer decision needs another attempt; use the debrief principle and try again."
        : "The scenario was completed; review the timeline to strengthen cue recognition.";

  return {
    cueRecognition,
    actionSequence,
    hazardExposure,
    resourceUse,
    responseTime,
    hintIndependence,
    transferSuccessful,
    improved,
    scoreEligible,
    overall,
    summary,
  };
}
