import type { FireAction } from "./actions";
import {
  availableFireActions,
  createFireTrainingState,
  fireTrainingReducer,
  type FireTrainingState,
} from "./reducer";

export type TrainerRuntimeState =
  | "booting"
  | "orienting"
  | "exploring"
  | "checkpointing"
  | "decision_ready"
  | "branch_rendering"
  | "consequence"
  | "rewinding"
  | "alternative_rendering"
  | "alternative"
  | "debrief"
  | "fatal";

export type LingBotRenderReceipt = {
  jobId: number;
  firstChunkIndex: number;
  startedAt: number;
  firstFrameAt: number;
};

export type FireRuntime = {
  phase: TrainerRuntimeState;
  training: FireTrainingState;
  checkpointId: string | null;
  pendingAction: { jobId: number; action: FireAction } | null;
  error: string | null;
};

export type FireRuntimeEvent =
  | { type: "LIVE_READY" }
  | { type: "LOCAL_ACTION"; action: FireAction }
  | { type: "CHECKPOINT_READY"; checkpointId: string }
  | { type: "BRANCH_REQUESTED"; jobId: number; action: FireAction }
  | { type: "BRANCH_RENDERED"; receipt: LingBotRenderReceipt }
  | { type: "BRANCH_FAILED"; jobId: number; message: string }
  | { type: "ALTERNATIVE_REQUESTED"; jobId: number; action: FireAction }
  | { type: "ALTERNATIVE_RENDERED"; receipt: LingBotRenderReceipt }
  | { type: "DEBRIEF_READY" }
  | { type: "FAIL"; message: string };

const localActions: FireAction[] = [
  "ListenAlarm",
  "InspectSmoke",
  "FeelDoor",
  "UsePhone",
  "SignalWindow",
];

function isBranchAction(state: FireTrainingState, action: FireAction): boolean {
  return (state.stage === "decision" && (action === "OpenDoor" || action === "KeepDoorClosed"))
    || (state.stage === "consequence" && action === "CrouchLow")
    || (state.stage === "secure-door" && action === "CloseDoor");
}

function phaseAfterLocalAction(training: FireTrainingState): TrainerRuntimeState {
  switch (training.stage) {
    case "observe-alarm": return "orienting";
    case "inspect-smoke":
    case "feel-door": return "exploring";
    case "decision": return "checkpointing";
    default: return "consequence";
  }
}

export function createFireRuntime(): FireRuntime {
  return {
    phase: "booting",
    training: createFireTrainingState(),
    checkpointId: null,
    pendingAction: null,
    error: null,
  };
}

export function fireRuntimeReducer(state: FireRuntime, event: FireRuntimeEvent): FireRuntime {
  if (event.type === "FAIL") {
    return { ...state, phase: "fatal", training: fireTrainingReducer(state.training, { type: "FAIL", message: event.message }), error: event.message, pendingAction: null };
  }
  if (event.type === "LIVE_READY") {
    if (state.phase !== "booting") return state;
    return {
      ...state,
      phase: "orienting",
      training: fireTrainingReducer(state.training, { type: "START" }),
      error: null,
    };
  }

  if (event.type === "LOCAL_ACTION") {
    if (state.pendingAction || !localActions.includes(event.action)) return state;
    const training = fireTrainingReducer(state.training, { type: "SUBMIT_ACTION", action: event.action });
    if (training === state.training) return state;
    return { ...state, training, phase: phaseAfterLocalAction(training), error: null };
  }

  if (event.type === "CHECKPOINT_READY") {
    if (state.phase !== "checkpointing" || state.training.stage !== "decision") return state;
    return { ...state, phase: "decision_ready", checkpointId: event.checkpointId, error: null };
  }

  if (event.type === "BRANCH_REQUESTED") {
    const decisionBranch = state.training.stage === "decision" && state.phase === "decision_ready";
    const recoveryBranch = (state.training.stage === "consequence" || state.training.stage === "secure-door")
      && state.phase === "consequence";
    if (state.pendingAction || !isBranchAction(state.training, event.action) || (!decisionBranch && !recoveryBranch)) return state;
    return {
      ...state,
      phase: "branch_rendering",
      pendingAction: { jobId: event.jobId, action: event.action },
      error: null,
    };
  }

  if (event.type === "BRANCH_RENDERED") {
    if (state.phase !== "branch_rendering" || !state.pendingAction || state.pendingAction.jobId !== event.receipt.jobId) return state;
    const training = fireTrainingReducer(state.training, {
      type: "SUBMIT_ACTION",
      action: state.pendingAction.action,
    });
    if (training === state.training) return state;
    return { ...state, phase: "consequence", training, pendingAction: null, error: null };
  }

  if (event.type === "BRANCH_FAILED") {
    if (
      (state.phase !== "branch_rendering" && state.phase !== "alternative_rendering")
      || !state.pendingAction
      || state.pendingAction.jobId !== event.jobId
    ) return state;
    return {
      ...state,
      phase: state.training.stage === "decision"
        ? "decision_ready"
        : state.training.stage === "counterfactual-decision"
          ? "alternative"
          : "consequence",
      pendingAction: null,
      error: event.message,
    };
  }

  if (event.type === "ALTERNATIVE_REQUESTED") {
    if (state.pendingAction) return state;
    const training = state.training.stage === "counterfactual-decision"
      ? state.training
      : state.phase === "consequence"
        ? fireTrainingReducer(
          fireTrainingReducer(state.training, { type: "START_COUNTERFACTUAL" }),
          { type: "RESTORE_COUNTERFACTUAL" }
        )
        : state.training;
    if (training.stage !== "counterfactual-decision" || !availableFireActions(training).includes(event.action)) return state;
    return {
      ...state,
      phase: "alternative_rendering",
      training,
      pendingAction: { jobId: event.jobId, action: event.action },
      error: null,
    };
  }

  if (event.type === "DEBRIEF_READY") {
    if (state.phase !== "alternative" || state.training.stage !== "counterfactual-consequence") return state;
    return {
      ...state,
      phase: "debrief",
      training: fireTrainingReducer(state.training, { type: "ADVANCE_DEBRIEF" }),
    };
  }

  if (state.phase !== "alternative_rendering" || !state.pendingAction || state.pendingAction.jobId !== event.receipt.jobId) return state;
  const training = fireTrainingReducer(state.training, {
    type: "SUBMIT_ACTION",
    action: state.pendingAction.action,
  });
  if (training === state.training) return state;
  return { ...state, phase: "alternative", training, pendingAction: null, error: null };
}
