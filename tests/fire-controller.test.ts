import { describe, expect, it } from "vitest";
import {
  computeFireDebrief,
  createInitialFireSession,
  fireReducer,
  oppositeBranch,
  restoreFireSnapshot,
  toSnapshot,
} from "../lib/fire/controller";
import type {
  FireControllerInput,
  FireSessionState,
  FireSnapshot,
} from "../lib/fire/types";
import { CREDITS } from "../lib/fire/safety-rules";

/** Training outcome view: strips presentation-only session mode. */
function trainingView(snapshot: FireSnapshot): Omit<FireSnapshot, "sessionMode"> {
  const { sessionMode: _ignored, ...rest } = snapshot;
  return rest;
}

const CUE_DISCOVERY: FireControllerInput[] = [
  { type: "DISCOVER_CUE", cueId: "alarm" },
  { type: "DISCOVER_CUE", cueId: "smoke-under-door" },
  { type: "DISCOVER_CUE", cueId: "phone" },
  { type: "DISCOVER_CUE", cueId: "window" },
  { type: "DISCOVER_CUE", cueId: "cloth" },
  { type: "DISCOVER_CUE", cueId: "flashlight" },
];

const SAFE_MITIGATIONS: FireControllerInput[] = [
  { type: "SEAL_GAP_WITH_CLOTH" },
  { type: "STAY_LOW_TOGGLE" },
  { type: "CALL_EMERGENCY" },
  { type: "TICK", seconds: 20 },
  { type: "WET_CLOTH_OVER_FACE" },
  { type: "SIGNAL_FROM_WINDOW" },
];

function runEpisode(
  mode: "provider" | "local-fallback",
  branch: "open-door" | "keep-door-closed",
  mitigations: FireControllerInput[]
): FireSessionState {
  let state = createInitialFireSession(mode);
  const dispatch = (input: FireControllerInput) => {
    state = fireReducer(state, input);
  };

  dispatch({ type: "BEGIN_EXPLORATION" });
  CUE_DISCOVERY.forEach(dispatch);
  dispatch({ type: "INSPECT_DOOR" });
  dispatch({ type: "SELECT_BRANCH", branch });
  mitigations.forEach(dispatch);

  const chosenBranchAtConsequence = branch;
  dispatch({ type: "CONSEQUENCE_COMPLETE" });

  expect(state.stage).toBe("counterfactual");
  expect(state.counterfactualBranch).toBe(oppositeBranch(chosenBranchAtConsequence));
  dispatch({ type: "APPLY_COUNTERFACTUAL_BRANCH", branch: state.counterfactualBranch! });
  dispatch({ type: "TICK", seconds: 10 });
  dispatch({ type: "CONSEQUENCE_COMPLETE" });
  expect(state.stage).toBe("debrief");
  dispatch({ type: "DEBRIEF_ACKNOWLEDGED" });

  return state;
}

describe("deterministic training controller", () => {
  it("produces the identical training snapshot for the same action sequence in provider and fallback modes", () => {
    const provider = runEpisode("provider", "keep-door-closed", SAFE_MITIGATIONS);
    const fallback = runEpisode("local-fallback", "keep-door-closed", SAFE_MITIGATIONS);

    expect(trainingView(toSnapshot(provider))).toEqual(trainingView(toSnapshot(fallback)));
    expect(computeFireDebrief(provider)).toEqual(computeFireDebrief(fallback));
  });

  it("produces deterministic exposure and scoring for repeated unsafe and safer branches", () => {
    const unsafeFirst = runEpisode("provider", "open-door", [{ type: "TICK", seconds: 15 }]);
    const unsafeSecond = runEpisode("local-fallback", "open-door", [{ type: "TICK", seconds: 15 }]);
    const safeRun = runEpisode("provider", "keep-door-closed", [{ type: "TICK", seconds: 15 }]);

    expect(trainingView(toSnapshot(unsafeFirst))).toEqual(
      trainingView(toSnapshot(unsafeSecond))
    );

    const unsafeDebrief = computeFireDebrief(unsafeFirst);
    const safeDebrief = computeFireDebrief(safeRun);

    const unsafeExposure = unsafeFirst.learnerRunState?.exposure ?? 0;
    const safeExposure = safeRun.learnerRunState?.exposure ?? 0;

    expect(unsafeExposure).toBeGreaterThan(safeExposure);
    expect(unsafeDebrief.outcomeClass).toBe("unsafe-future");
    expect(safeDebrief.outcomeClass).toBe("survived");
    expect(safeDebrief.score).toBeGreaterThan(unsafeDebrief.score);
    expect(unsafeDebrief.score).toBe(
      Math.round(100 - unsafeExposure * 0.6) + CREDITS.fullCueAwareness
    );
    // The live session ends on the counterfactual presentation, not the learner's run.
    expect(unsafeFirst.exposure).toBeLessThan(unsafeExposure);
  });

  it("deeply restores door, smoke, exposure, stage, cues, and branch state from a snapshot", () => {
    let state = runEpisode("provider", "keep-door-closed", SAFE_MITIGATIONS.slice(0, 3));
    const saved: FireSnapshot = toSnapshot(state);

    const mutated = restoreFireSnapshot(saved);
    mutated.stage = "complete";
    mutated.doorOpen = true;
    mutated.smokeLevel = 99;
    mutated.lightIntensity = 0.2;
    mutated.exposure = 100;
    mutated.penalties = 50;
    mutated.discoveredCueIds.push("nonexistent");
    mutated.completedActionIds.length = 0;

    const restored = restoreFireSnapshot(saved);
    expect(toSnapshot(restored)).toEqual(saved);
    expect(restored.runtimeFlags).toEqual({
      gapSealed: false,
      faceCovered: false,
      stayingLow: false,
      emergencyCalled: false,
      signalSent: false,
      windowOpened: false,
    });
  });

  it("rejects unreviewed and unavailable actions locally without mutating training state", () => {
    let state = createInitialFireSession("provider");
    state = fireReducer(state, { type: "BEGIN_EXPLORATION" });

    // Unreviewed action types never exist in the reviewed catalog.
    const unreviewedState = fireReducer(state, {
      type: "TELEPORT_TO_ROOF",
    } as unknown as FireControllerInput);
    expect(unreviewedState).toBe(state);

    // Reviewed but cue-gated actions are rejected until their cues are discovered.
    const beforeCloth = state;
    state = fireReducer(state, { type: "SEAL_GAP_WITH_CLOTH" });
    expect(state).toBe(beforeCloth);

    state = fireReducer(state, { type: "DISCOVER_CUE", cueId: "cloth" });

    // Wet cloth requires the gap sealed first.
    const beforeSeal = state;
    const wetTooEarly = fireReducer(state, { type: "WET_CLOTH_OVER_FACE" });
    expect(wetTooEarly).toBe(beforeSeal);

    const sealed = fireReducer(state, { type: "SEAL_GAP_WITH_CLOTH" });
    expect(sealed.runtimeFlags.gapSealed).toBe(true);
    expect(sealed.completedActionIds).toContain("seal-gap-with-cloth");

    const covered = fireReducer(sealed, { type: "WET_CLOTH_OVER_FACE" });
    expect(covered.runtimeFlags.faceCovered).toBe(true);

    // Duplicate cue discovery is a no-op.
    const duplicate = fireReducer(state, { type: "DISCOVER_CUE", cueId: "cloth" });
    expect(duplicate).toBe(state);

    // Branch selection is first-choice-only and stage-gated.
    const chosen = fireReducer(fireReducer(state, { type: "INSPECT_DOOR" }), {
      type: "SELECT_BRANCH",
      branch: "keep-door-closed",
    });
    expect(fireReducer(chosen, { type: "SELECT_BRANCH", branch: "open-door" })).toBe(chosen);
  });

  it("renders local branches stably across repeated replays from the same snapshot", () => {
    let state = createInitialFireSession("local-fallback");
    state = fireReducer(state, { type: "BEGIN_EXPLORATION" });
    CUE_DISCOVERY.forEach((input) => (state = fireReducer(state, input)));
    state = fireReducer(state, { type: "INSPECT_DOOR" });
    state = fireReducer(state, { type: "SELECT_BRANCH", branch: "keep-door-closed" });

    const replayFrom = (): FireSessionState => {
      let replay = restoreFireSnapshot(toSnapshot(state));
      SAFE_MITIGATIONS.forEach((input) => (replay = fireReducer(replay, input)));
      return replay;
    };

    expect(toSnapshot(replayFrom())).toEqual(toSnapshot(replayFrom()));
  });

  it("runs the counterfactual from the same pre-decision snapshot with the opposite branch", () => {
    const state = runEpisode("provider", "open-door", SAFE_MITIGATIONS);

    expect(state.decidedBranch).toBe("open-door");
    expect(state.counterfactualBranch).toBe("keep-door-closed");
    expect(state.preDecisionSnapshot?.chosenBranch).toBeUndefined();
    expect(state.preDecisionSnapshot?.doorOpen).toBe(false);
    expect(state.preDecisionSnapshot?.exposure).toBe(0);
    // The debrief assesses the learner's own run, not the replayed alternative.
    expect(computeFireDebrief(state).outcomeClass).toBe("unsafe-future");
    expect(state.learnerRunState?.doorOpen).toBe(true);
  });

  it("never scores an incomplete episode and grounds the debrief in the reviewed source", () => {
    let state = createInitialFireSession("provider");

    // Debrief acknowledgement is impossible before consequence resolution.
    expect(fireReducer(state, { type: "DEBRIEF_ACKNOWLEDGED" })).toBe(state);

    state = runEpisode("provider", "keep-door-closed", SAFE_MITIGATIONS);
    const debrief = computeFireDebrief(state);

    expect(debrief.sourceOrganization).toBe("American Red Cross");
    expect(debrief.recommendedBranch).toBe("keep-door-closed");
    expect(debrief.situationalAwarenessRatio).toBeLessThanOrEqual(1);
    expect(debrief.score).toBeGreaterThanOrEqual(0);
    expect(debrief.score).toBeLessThanOrEqual(100);
  });

  it("penalizes opening the window as an unsafe action while still enabling signalling", () => {
    const windowOpened = runEpisode("provider", "keep-door-closed", [
      { type: "OPEN_WINDOW" },
      { type: "SEAL_GAP_WITH_CLOTH" },
      { type: "STAY_LOW_TOGGLE" },
      { type: "CALL_EMERGENCY" },
      { type: "TICK", seconds: 20 },
      { type: "SIGNAL_FROM_WINDOW" },
    ]);
    const disciplined = runEpisode("provider", "keep-door-closed", [
      { type: "SEAL_GAP_WITH_CLOTH" },
      { type: "STAY_LOW_TOGGLE" },
      { type: "CALL_EMERGENCY" },
      { type: "TICK", seconds: 20 },
    ]);

    const openedDebrief = computeFireDebrief(windowOpened);
    const disciplinedDebrief = computeFireDebrief(disciplined);

    expect(windowOpened.learnerRunState?.unsafeActionIds).toContain("open-window");
    expect(windowOpened.learnerRunState?.penalties ?? 0).toBeGreaterThan(
      disciplined.learnerRunState?.penalties ?? 0
    );
    expect(windowOpened.learnerRunState?.runtimeFlags.signalSent).toBe(true);
    expect(openedDebrief.score).toBeLessThan(disciplinedDebrief.score);
  });
});
