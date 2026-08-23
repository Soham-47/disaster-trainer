import {
  CREDITS,
  DEBRIEF_LINES,
  EXPOSURE_MULTIPLIERS,
  EXPOSURE_RATES,
  FIRE_CUES,
  FIRE_SOURCE,
  PENALTIES,
  RECOMMENDED_BRANCH,
  REVIEWED_FIRE_ACTIONS,
  THRESHOLDS,
} from "./safety-rules";
import type {
  FireAction,
  FireBranch,
  FireControllerInput,
  FireDebrief,
  FireInteractableAction,
  FireOutcomeClass,
  FireRuntimeFlag,
  FireSessionState,
  FireSnapshot,
  SessionMode,
} from "./types";

const TOTAL_CUE_AWARENESS_WEIGHT = Object.values(FIRE_CUES).reduce(
  (total, cue) => total + cue.awarenessWeight,
  0
);

const EMPTY_FLAGS: Record<FireRuntimeFlag, boolean> = {
  gapSealed: false,
  faceCovered: false,
  stayingLow: false,
  emergencyCalled: false,
  signalSent: false,
  windowOpened: false,
};

const ACTION_ID_BY_TYPE: Record<FireInteractableAction["type"], string> = {
  SEAL_GAP_WITH_CLOTH: "seal-gap-with-cloth",
  WET_CLOTH_OVER_FACE: "wet-cloth-over-face",
  STAY_LOW_TOGGLE: "stay-low-toggle",
  OPEN_WINDOW: "open-window",
  CALL_EMERGENCY: "call-emergency",
  SIGNAL_FROM_WINDOW: "signal-from-window",
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function createInitialFireSession(mode: SessionMode): FireSessionState {
  return {
    stage: "orient",
    sessionMode: mode,
    discoveredCueIds: [],
    completedActionIds: [],
    exposure: 0,
    penalties: 0,
    cameraPreset: "apartment-bedroom-wide",
    doorOpen: false,
    smokeLevel: 0,
    lightIntensity: 1,
    tickCount: 0,
    elapsedSeconds: 0,
    runtimeFlags: { ...EMPTY_FLAGS },
    unsafeActionIds: [],
    preDecisionSnapshot: null,
    learnerRunState: null,
  };
}

export function toSnapshot(state: FireSessionState): FireSnapshot {
  return {
    stage: state.stage,
    sessionMode: state.sessionMode,
    discoveredCueIds: [...state.discoveredCueIds],
    completedActionIds: [...state.completedActionIds],
    chosenBranch: state.chosenBranch,
    exposure: state.exposure,
    penalties: state.penalties,
    cameraPreset: state.cameraPreset,
    doorOpen: state.doorOpen,
    smokeLevel: state.smokeLevel,
    lightIntensity: state.lightIntensity,
  };
}

function actionIsAvailable(actionId: string, state: FireSessionState): boolean {
  const rule = REVIEWED_FIRE_ACTIONS[actionId];
  if (!rule) return false;
  const hasCues = rule.requiresCueIds.every((cueId) =>
    state.discoveredCueIds.includes(cueId)
  );
  const hasFlags = (rule.requiresFlags ?? []).every(
    (flag) => state.runtimeFlags[flag as FireRuntimeFlag]
  );
  return hasCues && hasFlags;
}

function currentExposureRate(state: FireSessionState): number {
  const base = state.doorOpen
    ? EXPOSURE_RATES.openDoorPerSecond
    : EXPOSURE_RATES.closedDoorPerSecond;
  let multiplier = 1;
  if (state.runtimeFlags.gapSealed) multiplier *= EXPOSURE_MULTIPLIERS.gapSealed;
  if (state.runtimeFlags.faceCovered) multiplier *= EXPOSURE_MULTIPLIERS.faceCovered;
  if (state.runtimeFlags.stayingLow) multiplier *= EXPOSURE_MULTIPLIERS.stayingLow;
  return base * multiplier + EXPOSURE_RATES.ambientPerSecond;
}

function advanceVisuals(state: FireSessionState, seconds: number): void {
  state.smokeLevel = round3(
    clamp(state.smokeLevel + seconds * (state.doorOpen ? 2 : 0.8), 0, THRESHOLDS.smokeCap)
  );
  state.lightIntensity = round3(clamp(1 - state.smokeLevel / 150, 0.2, 1));
}

function applyInteractable(
  state: FireSessionState,
  action: FireInteractableAction
): FireSessionState {
  const actionId = ACTION_ID_BY_TYPE[action.type];
  if (!actionId || !actionIsAvailable(actionId, state)) return state;

  const next = clone(state);
  switch (action.type) {
    case "SEAL_GAP_WITH_CLOTH":
      next.runtimeFlags.gapSealed = true;
      break;
    case "WET_CLOTH_OVER_FACE":
      next.runtimeFlags.faceCovered = true;
      break;
    case "STAY_LOW_TOGGLE":
      next.runtimeFlags.stayingLow = !next.runtimeFlags.stayingLow;
      break;
    case "OPEN_WINDOW":
      if (next.runtimeFlags.windowOpened) return state;
      next.runtimeFlags.windowOpened = true;
      next.penalties += PENALTIES.windowOpened;
      next.unsafeActionIds.push(actionId);
      break;
    case "CALL_EMERGENCY":
      if (next.runtimeFlags.emergencyCalled) return state;
      next.runtimeFlags.emergencyCalled = true;
      break;
    case "SIGNAL_FROM_WINDOW":
      if (next.runtimeFlags.signalSent) return state;
      next.runtimeFlags.signalSent = true;
      break;
  }
  if (!next.completedActionIds.includes(actionId)) next.completedActionIds.push(actionId);
  return next;
}

export function fireReducer(state: FireSessionState, input: FireControllerInput): FireSessionState {
  switch (input.type) {
    case "BEGIN_EXPLORATION":
      if (state.stage !== "orient") return state;
      return { ...clone(state), stage: "explore" };

    case "DISCOVER_CUE": {
      if (state.stage !== "explore" && state.stage !== "inspect-cues") return state;
      if (!(input.cueId in FIRE_CUES)) return state;
      if (state.discoveredCueIds.includes(input.cueId)) return state;
      const discovered = clone(state);
      discovered.discoveredCueIds.push(input.cueId);
      discovered.discoveredCueIds.sort();
      return discovered;
    }

    case "INSPECT_DOOR": {
      if (state.stage !== "explore") return state;
      const next = clone(state);
      next.stage = "inspect-cues";
      if (!next.discoveredCueIds.includes("warm-door")) next.discoveredCueIds.push("warm-door");
      next.discoveredCueIds.sort();
      next.completedActionIds.push("inspect-door");
      next.cameraPreset = "door-closeup";
      return next;
    }

    case "SELECT_BRANCH": {
      if (state.stage !== "inspect-cues" && state.stage !== "decision") return state;
      if (state.chosenBranch) return state;
      const next = clone(state);
      next.preDecisionSnapshot = toSnapshot({ ...next, stage: "decision" });
      next.chosenBranch = input.branch;
      next.decidedBranch = input.branch;
      applyBranchEffects(next, input.branch);
      next.stage = "consequence";
      return next;
    }

    case "APPLY_COUNTERFACTUAL_BRANCH": {
      if (state.stage !== "counterfactual") return state;
      if (input.branch !== state.counterfactualBranch) return state;
      const next = clone(state);
      applyBranchEffects(next, input.branch);
      return next;
    }

    case "TICK": {
      if (state.stage !== "consequence" && state.stage !== "counterfactual") return state;
      const seconds = clamp(input.seconds, 0, THRESHOLDS.maxTickSeconds);
      if (seconds <= 0) return state;
      const next = clone(state);
      next.tickCount += 1;
      next.elapsedSeconds = round3(next.elapsedSeconds + seconds);
      next.exposure = round3(
        clamp(next.exposure + seconds * currentExposureRate(next), 0, THRESHOLDS.exposureCap)
      );
      advanceVisuals(next, seconds);
      return next;
    }

    case "CONSEQUENCE_COMPLETE": {
      if (state.stage === "consequence" && state.preDecisionSnapshot) {
        const learnerRunState = clone(state);
        const restored = restoreFireSnapshot({
          ...state.preDecisionSnapshot,
          sessionMode: state.sessionMode,
        });
        restored.counterfactualBranch =
          state.decidedBranch === "open-door" ? "keep-door-closed" : "open-door";
        restored.decidedBranch = state.decidedBranch;
        restored.learnerRunState = learnerRunState;
        restored.preDecisionSnapshot = state.preDecisionSnapshot;
        restored.stage = "counterfactual";
        return restored;
      }
      if (state.stage === "consequence" || state.stage === "counterfactual") {
        const next = clone(state);
        next.stage = "debrief";
        return next;
      }
      return state;
    }

    case "DEBRIEF_ACKNOWLEDGED":
      if (state.stage !== "debrief") return state;
      return { ...clone(state), stage: "complete" };

    case "RESTART_EPISODE":
      return createInitialFireSession(state.sessionMode);

    default:
      return applyInteractable(state, input as FireInteractableAction);
  }
}

function applyBranchEffects(state: FireSessionState, branch: FireBranch): void {
  if (branch === "open-door") {
    state.doorOpen = true;
    state.cameraPreset = "doorway-hallway";
    state.exposure = round3(state.exposure + EXPOSURE_RATES.openDoorImmediateInflux);
  } else {
    state.cameraPreset = "sealed-room";
  }
}

export function restoreFireSnapshot(snapshot: FireSnapshot): FireSessionState {
  return {
    ...clone(snapshot),
    tickCount: 0,
    elapsedSeconds: 0,
    runtimeFlags: { ...EMPTY_FLAGS },
    unsafeActionIds: [],
    preDecisionSnapshot: null,
    learnerRunState: null,
  };
}

export function situationalAwarenessRatio(discoveredCueIds: string[]): number {
  const earned = discoveredCueIds.reduce(
    (total, cueId) => total + (FIRE_CUES[cueId as keyof typeof FIRE_CUES]?.awarenessWeight ?? 0),
    0
  );
  return round3(earned / TOTAL_CUE_AWARENESS_WEIGHT);
}

export function computeFireDebrief(state: FireSessionState): FireDebrief {
  const assessed = state.learnerRunState ?? state;
  const branch = assessed.decidedBranch ?? assessed.chosenBranch;

  const outcomeClass: FireOutcomeClass =
    branch === "keep-door-closed"
      ? assessed.exposure < THRESHOLDS.exposureCollapse
        ? "survived"
        : "collapsed"
      : "unsafe-future";

  const awarenessRatio = situationalAwarenessRatio(assessed.discoveredCueIds);

  let score = 100;
  score -= assessed.exposure * 0.6;
  score -= assessed.penalties;
  score -= assessed.unsafeActionIds.length * 10;
  if (assessed.runtimeFlags.emergencyCalled) score += CREDITS.emergencyCalled;
  if (assessed.runtimeFlags.signalSent) score += CREDITS.signalSent;
  if (awarenessRatio >= 1) score += CREDITS.fullCueAwareness;
  score = Math.round(clamp(score, 0, 100));

  return {
    outcomeClass,
    score,
    exposureFinal: assessed.exposure,
    situationalAwarenessRatio: awarenessRatio,
    recommendedBranch: RECOMMENDED_BRANCH,
    principleLine: DEBRIEF_LINES.principle,
    warningCueLine: DEBRIEF_LINES.warningCue,
    sourceTitle: FIRE_SOURCE.title,
    sourceOrganization: FIRE_SOURCE.organization,
    sourceUrl: FIRE_SOURCE.url,
  };
}

export function oppositeBranch(branch: FireBranch): FireBranch {
  return branch === "open-door" ? "keep-door-closed" : "open-door";
}
