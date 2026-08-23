import { describe, expect, it } from "vitest";
import {
  availableFireActions,
  createFireTrainingState,
  fireTrainingReducer,
  scoreFireTraining,
} from "../lib/fire-training/reducer";

function submit(state: ReturnType<typeof createFireTrainingState>, action: Parameters<typeof fireTrainingReducer>[1] & { type: "SUBMIT_ACTION" }) {
  return fireTrainingReducer(state, action);
}

describe("apartment-fire training reducer", () => {
  it("completes the reviewed safer sequence deterministically", () => {
    let state = fireTrainingReducer(createFireTrainingState(), { type: "START" });
    for (const action of ["ListenAlarm", "InspectSmoke", "FeelDoor", "KeepDoorClosed", "UsePhone", "SignalWindow"] as const) {
      state = submit(state, { type: "SUBMIT_ACTION", action });
    }

    expect(state.stage).toBe("outcome");
    expect(state.initialDecision).toBe("KeepDoorClosed");
    expect(state.exposure).toBe(0);
    expect(state.discoveredCues).toEqual(["alarm", "smoke-under-door", "warm-door"]);
    expect(scoreFireTraining(state, true).overall).toBeGreaterThanOrEqual(90);
  });

  it("allows recovery after opening the warm door without changing the teaching truth", () => {
    let state = fireTrainingReducer(createFireTrainingState(), { type: "START" });
    for (const action of ["ListenAlarm", "InspectSmoke", "FeelDoor", "OpenDoor", "CrouchLow"] as const) {
      state = submit(state, { type: "SUBMIT_ACTION", action });
    }

    expect(state.recovered).toBe(false);
    expect(availableFireActions(state)).toEqual(["CloseDoor"]);
    state = submit(state, { type: "SUBMIT_ACTION", action: "CloseDoor" });
    state = submit(state, { type: "SUBMIT_ACTION", action: "UsePhone" });

    expect(state.stage).toBe("outcome");
    expect(state.initialDecision).toBe("OpenDoor");
    expect(state.recovered).toBe(true);
    expect(state.exposure).toBe(45);
    expect(scoreFireTraining(state, true).actionSequence).toBeLessThan(100);
  });

  it("ignores unavailable and repeated interactions", () => {
    const started = fireTrainingReducer(createFireTrainingState(), { type: "START" });
    expect(fireTrainingReducer(started, { type: "SUBMIT_ACTION", action: "OpenDoor" })).toEqual(started);
    const listened = fireTrainingReducer(started, { type: "SUBMIT_ACTION", action: "ListenAlarm" });
    expect(fireTrainingReducer(listened, { type: "SUBMIT_ACTION", action: "ListenAlarm" })).toEqual(listened);
  });

  it("offers only the opposite decision after restarting the same world", () => {
    let state = fireTrainingReducer(createFireTrainingState(), { type: "START" });
    for (const action of ["ListenAlarm", "InspectSmoke", "FeelDoor", "KeepDoorClosed", "UsePhone", "SignalWindow"] as const) {
      state = fireTrainingReducer(state, { type: "SUBMIT_ACTION", action });
    }
    state = fireTrainingReducer(state, { type: "START_COUNTERFACTUAL" });
    state = fireTrainingReducer(state, { type: "RESTORE_COUNTERFACTUAL" });

    expect(state.stage).toBe("counterfactual-decision");
    expect(availableFireActions(state)).toEqual(["OpenDoor"]);
    state = fireTrainingReducer(state, { type: "SUBMIT_ACTION", action: "OpenDoor" });
    expect(state.stage).toBe("counterfactual-consequence");
    expect(state.alternativeDecision).toBe("OpenDoor");
  });

  it("marks a non-live run as visible but ineligible for scoring", () => {
    const assessment = scoreFireTraining(createFireTrainingState(), false);
    expect(assessment.scoreEligible).toBe(false);
  });
});
