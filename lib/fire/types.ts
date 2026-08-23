export type SessionMode = "provider" | "local-fallback";

export type FireStage =
  | "orient"
  | "explore"
  | "inspect-cues"
  | "decision"
  | "consequence"
  | "counterfactual"
  | "debrief"
  | "complete";

export type FireBranch = "open-door" | "keep-door-closed";

export type FireCueId =
  | "alarm"
  | "smoke-under-door"
  | "warm-door"
  | "phone"
  | "window"
  | "flashlight"
  | "cloth";

export type FireSnapshot = {
  stage: FireStage;
  sessionMode: SessionMode;
  discoveredCueIds: string[];
  completedActionIds: string[];
  chosenBranch?: FireBranch;
  exposure: number;
  penalties: number;
  cameraPreset: string;
  doorOpen: boolean;
  smokeLevel: number;
  lightIntensity: number;
};

export type FireRuntimeFlag =
  | "gapSealed"
  | "faceCovered"
  | "stayingLow"
  | "emergencyCalled"
  | "signalSent"
  | "windowOpened";

export type FireSessionState = FireSnapshot & {
  tickCount: number;
  elapsedSeconds: number;
  runtimeFlags: Record<FireRuntimeFlag, boolean>;
  unsafeActionIds: string[];
  preDecisionSnapshot: FireSnapshot | null;
  counterfactualBranch?: FireBranch;
  /** The learner's actual decision, preserved across counterfactual restores. */
  decidedBranch?: FireBranch;
  /** Full frozen state of the learner's own run, used for debrief assessment. */
  learnerRunState: FireSessionState | null;
};

export type FireAction =
  | { type: "BEGIN_EXPLORATION" }
  | { type: "DISCOVER_CUE"; cueId: FireCueId }
  | { type: "INSPECT_DOOR" }
  | { type: "SELECT_BRANCH"; branch: FireBranch }
  | { type: "APPLY_COUNTERFACTUAL_BRANCH"; branch: FireBranch }
  | { type: "TICK"; seconds: number }
  | { type: "CONSEQUENCE_COMPLETE" }
  | { type: "DEBRIEF_ACKNOWLEDGED" }
  | { type: "RESTART_EPISODE" };

export type FireInteractableAction =
  | { type: "SEAL_GAP_WITH_CLOTH" }
  | { type: "WET_CLOTH_OVER_FACE" }
  | { type: "STAY_LOW_TOGGLE" }
  | { type: "OPEN_WINDOW" }
  | { type: "CALL_EMERGENCY" }
  | { type: "SIGNAL_FROM_WINDOW" };

/** Union of everything the deterministic controller accepts. */
export type FireControllerInput = FireAction | FireInteractableAction;

export type FireOutcomeClass = "survived" | "collapsed" | "unsafe-future";

export type FireDebrief = {
  outcomeClass: FireOutcomeClass;
  score: number;
  exposureFinal: number;
  situationalAwarenessRatio: number;
  recommendedBranch: FireBranch;
  principleLine: string;
  warningCueLine: string;
  sourceTitle: string;
  sourceOrganization: string;
  sourceUrl: string;
};
