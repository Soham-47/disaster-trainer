import type { ReviewedFireAction } from "../happy-oyster/fire-client";

export type FireTrainingStage =
  | "briefing"
  | "observe-alarm"
  | "inspect-smoke"
  | "feel-door"
  | "decision"
  | "consequence"
  | "secure-door"
  | "response"
  | "outcome"
  | "restarting"
  | "counterfactual-decision"
  | "counterfactual-consequence"
  | "debrief"
  | "error";

export type FireDecision = "OpenDoor" | "KeepDoorClosed";

export type FireTrainingEvent = {
  action: ReviewedFireAction;
  stage: FireTrainingStage;
  consequence: string;
};

export type FireTrainingState = {
  stage: FireTrainingStage;
  completedActions: ReviewedFireAction[];
  discoveredCues: string[];
  initialDecision: FireDecision | null;
  alternativeDecision: FireDecision | null;
  exposure: number;
  recovered: boolean;
  hintsUsed: number;
  error: string | null;
  events: FireTrainingEvent[];
};

export type FireTrainingAction =
  | { type: "START" }
  | { type: "SUBMIT_ACTION"; action: ReviewedFireAction }
  | { type: "REQUEST_HINT" }
  | { type: "START_COUNTERFACTUAL" }
  | { type: "RESTORE_COUNTERFACTUAL" }
  | { type: "ADVANCE_DEBRIEF" }
  | { type: "FAIL"; message: string }
  | { type: "RESTART" };

export type FireAssessment = {
  cueRecognition: number;
  actionSequence: number;
  hazardExposure: number;
  resourceUse: number;
  hintIndependence: number;
  scoreEligible: boolean;
  overall: number;
};

export function createFireTrainingState(): FireTrainingState {
  return {
    stage: "briefing",
    completedActions: [],
    discoveredCues: [],
    initialDecision: null,
    alternativeDecision: null,
    exposure: 0,
    recovered: false,
    hintsUsed: 0,
    error: null,
    events: [],
  };
}

export function availableFireActions(state: FireTrainingState): ReviewedFireAction[] {
  switch (state.stage) {
    case "observe-alarm": return ["ListenAlarm"];
    case "inspect-smoke": return ["InspectSmoke"];
    case "feel-door": return ["FeelDoor"];
    case "decision": return ["OpenDoor", "KeepDoorClosed"];
    case "consequence": return state.initialDecision === "OpenDoor" ? ["CrouchLow"] : ["UsePhone"];
    case "secure-door": return ["CloseDoor"];
    case "response": return state.initialDecision === "OpenDoor" ? ["UsePhone"] : ["SignalWindow"];
    case "counterfactual-decision":
      return state.initialDecision === "OpenDoor" ? ["KeepDoorClosed"] : ["OpenDoor"];
    default: return [];
  }
}

const cueForAction: Partial<Record<ReviewedFireAction, string>> = {
  ListenAlarm: "alarm",
  InspectSmoke: "smoke-under-door",
  FeelDoor: "warm-door",
};

const consequenceForAction: Record<ReviewedFireAction, string> = {
  ListenAlarm: "The alarm is continuous: treat it as a real fire warning.",
  InspectSmoke: "Smoke is entering beneath the only hallway door.",
  FeelDoor: "The door is warm, warning that fire may be on the other side.",
  OpenDoor: "Opening the warm door admits hot smoke and increases exposure.",
  CloseDoor: "Closing the door again restores part of the barrier between you and the hot hallway.",
  KeepDoorClosed: "The closed door continues to separate you from smoke and heat.",
  UsePhone: "Emergency services receive your location and apartment details.",
  SignalWindow: "Your position becomes visible to responders while the door stays closed.",
  CrouchLow: "Moving low reduces some smoke exposure, but cannot undo opening the door.",
};

export function fireTrainingReducer(
  state: FireTrainingState,
  event: FireTrainingAction
): FireTrainingState {
  if (event.type === "RESTART") return createFireTrainingState();
  if (event.type === "START") return { ...createFireTrainingState(), stage: "observe-alarm" };
  if (event.type === "FAIL") return { ...state, stage: "error", error: event.message };
  if (event.type === "REQUEST_HINT") return { ...state, hintsUsed: state.hintsUsed + 1 };
  if (event.type === "START_COUNTERFACTUAL" && state.stage === "outcome") {
    return { ...state, stage: "restarting" };
  }
  if (event.type === "RESTORE_COUNTERFACTUAL" && state.stage === "restarting") {
    return { ...state, stage: "counterfactual-decision" };
  }
  if (event.type === "ADVANCE_DEBRIEF" && state.stage === "counterfactual-consequence") {
    return { ...state, stage: "debrief" };
  }
  if (event.type !== "SUBMIT_ACTION") return state;

  const allowed = availableFireActions(state);
  if (!allowed.includes(event.action) || state.completedActions.includes(event.action)) return state;

  const cue = cueForAction[event.action];
  const completedActions = [...state.completedActions, event.action];
  const discoveredCues = cue && !state.discoveredCues.includes(cue)
    ? [...state.discoveredCues, cue]
    : state.discoveredCues;
  const events = [
    ...state.events,
    { action: event.action, stage: state.stage, consequence: consequenceForAction[event.action] },
  ];

  if (state.stage === "counterfactual-decision") {
    return {
      ...state,
      completedActions,
      alternativeDecision: event.action as FireDecision,
      stage: "counterfactual-consequence",
      events,
    };
  }

  switch (event.action) {
    case "ListenAlarm":
      return { ...state, completedActions, discoveredCues, events, stage: "inspect-smoke" };
    case "InspectSmoke":
      return { ...state, completedActions, discoveredCues, events, stage: "feel-door" };
    case "FeelDoor":
      return { ...state, completedActions, discoveredCues, events, stage: "decision" };
    case "OpenDoor":
      return { ...state, completedActions, initialDecision: "OpenDoor", exposure: 65, events, stage: "consequence" };
    case "KeepDoorClosed":
      return { ...state, completedActions, initialDecision: "KeepDoorClosed", events, stage: "consequence" };
    case "CrouchLow":
      return { ...state, completedActions, exposure: Math.max(0, state.exposure - 10), events, stage: "secure-door" };
    case "CloseDoor":
      return { ...state, completedActions, recovered: true, exposure: Math.max(0, state.exposure - 10), events, stage: "response" };
    case "UsePhone":
      return { ...state, completedActions, events, stage: state.initialDecision === "OpenDoor" ? "outcome" : "response" };
    case "SignalWindow":
      return { ...state, completedActions, events, stage: "outcome" };
  }
}

export function scoreFireTraining(state: FireTrainingState, live: boolean): FireAssessment {
  const cueRecognition = Math.round((state.discoveredCues.length / 3) * 100);
  const actionSequence = state.initialDecision === "KeepDoorClosed" ? 100 : state.recovered ? 55 : 20;
  const hazardExposure = Math.max(0, 100 - state.exposure);
  const resourceUse = state.completedActions.includes("UsePhone") ? 100 : 0;
  const hintIndependence = Math.max(0, 100 - state.hintsUsed * 20);
  const overall = Math.round(
    cueRecognition * 0.2 +
    actionSequence * 0.3 +
    hazardExposure * 0.25 +
    resourceUse * 0.15 +
    hintIndependence * 0.1
  );
  return {
    cueRecognition,
    actionSequence,
    hazardExposure,
    resourceUse,
    hintIndependence,
    scoreEligible: live,
    overall,
  };
}
