import { describe, expect, it } from "vitest";
import {
  initialPlayerState,
  playerReducer,
  type PlayerState,
} from "../lib/player/state-machine";

function stateAfter(...actions: Parameters<typeof playerReducer>[1][]): PlayerState {
  return actions.reduce(playerReducer, initialPlayerState);
}

describe("playerReducer", () => {
  it("walks the learner through the complete counterfactual loop", () => {
    const state = stateAfter(
      { type: "START_SCENARIO", scenarioId: "structure-fire-v1" },
      { type: "ORIENT_COMPLETE" },
      { type: "SELECT_CHOICE", choiceId: "open-door" },
      { type: "CONSEQUENCE_COMPLETE" },
      { type: "REWIND_COMPLETE" },
      { type: "ALTERNATIVE_COMPLETE" },
      { type: "DEBRIEF_NEXT" },
      { type: "SUBMIT_TRANSFER", choiceId: "keep-door-closed" }
    );

    expect(state.current).toBe("result");
    expect(state.initialChoiceId).toBe("open-door");
    expect(state.transferChoiceId).toBe("keep-door-closed");
    expect(state.isRewinding).toBe(false);
    expect(state.startedAt).not.toBeNull();
  });

  it("ignores actions that are invalid for the current state", () => {
    const state = playerReducer(initialPlayerState, {
      type: "SELECT_CHOICE",
      choiceId: "open-door",
    });

    expect(state).toEqual(initialPlayerState);
    expect(playerReducer(initialPlayerState, { type: "START_REWIND" })).toEqual(initialPlayerState);
  });

  it("accepts only the first decision choice", () => {
    const atDecision = stateAfter(
      { type: "START_SCENARIO", scenarioId: "structure-fire-v1" },
      { type: "ORIENT_COMPLETE" }
    );

    const afterFirst = playerReducer(atDecision, {
      type: "SELECT_CHOICE",
      choiceId: "open-door",
    });
    const afterSecond = playerReducer(afterFirst, {
      type: "SELECT_CHOICE",
      choiceId: "keep-door-closed",
    });

    expect(afterSecond).toBe(afterFirst);
    expect(afterSecond.initialChoiceId).toBe("open-door");
  });

  it("marks rewind only after the chosen consequence completes", () => {
    const atConsequence = stateAfter(
      { type: "START_SCENARIO", scenarioId: "structure-fire-v1" },
      { type: "ORIENT_COMPLETE" },
      { type: "SELECT_CHOICE", choiceId: "open-door" }
    );

    const rewinding = playerReducer(atConsequence, { type: "CONSEQUENCE_COMPLETE" });

    expect(rewinding.current).toBe("rewind");
    expect(rewinding.isRewinding).toBe(true);
  });

  it("resets the whole session and preserves an explicit failure state", () => {
    const active = stateAfter({ type: "START_SCENARIO", scenarioId: "structure-fire-v1" });
    const failed = playerReducer(active, { type: "FAIL", error: "prepared fallback unavailable" });

    expect(failed.current).toBe("error");
    expect(failed.errorMessage).toBe("prepared fallback unavailable");
    expect(playerReducer(failed, { type: "RESTART" })).toEqual(initialPlayerState);
  });
});
