import { describe, expect, it } from "vitest";
import { scoreSession } from "../lib/scenario/scoring";
import { scoreSimulation } from "../lib/scenario/scoring";
import type { SimulationState } from "../lib/player/simulation-reducer";
import type { ChoiceDefinition } from "../lib/scenario/types";

const safeChoice: ChoiceDefinition = {
  id: "safe",
  label: "Safe",
  safetyClass: "safe",
  consequenceStateId: "safe-consequence",
};
const unsafeChoice: ChoiceDefinition = {
  id: "unsafe",
  label: "Unsafe",
  safetyClass: "unsafe",
  consequenceStateId: "unsafe-consequence",
};

function input(initialChoice: ChoiceDefinition, transferChoice: ChoiceDefinition, generationMode: "live" | "fallback" = "live") {
  return {
    sessionId: "session-1",
    scenarioId: "scenario-1",
    initialChoice,
    transferChoice,
    generationMode,
    generationValidated: generationMode === "live",
    startedAt: "2026-08-23T00:00:00.000Z",
    completedAt: "2026-08-23T00:01:00.000Z",
  };
}

describe("session scoring", () => {
  it.each([
    ["unsafe to safe", unsafeChoice, safeChoice, true, true],
    ["unsafe to unsafe", unsafeChoice, unsafeChoice, false, false],
    ["safe to safe", safeChoice, safeChoice, true, false],
    ["safe to unsafe", safeChoice, unsafeChoice, false, false],
  ])("calculates %s", (_name, initial, transfer, transferSuccessful, improved) => {
    const result = scoreSession(input(initial, transfer));

    expect(result.transferSuccessful).toBe(transferSuccessful);
    expect(result.improved).toBe(improved);
    expect(result.scoreEligible).toBe(true);
  });

  it("never makes a fallback run score eligible", () => {
    const result = scoreSession(input(unsafeChoice, safeChoice, "fallback"));

    expect(result.transferSuccessful).toBe(true);
    expect(result.improved).toBe(true);
    expect(result.generationMode).toBe("fallback");
    expect(result.generationValidated).toBe(false);
    expect(result.scoreEligible).toBe(false);
  });

  it("scores improvement when an unsafe primary action is followed by a safe transfer action", () => {
    const primary = {
      world: { discoveredCueIds: ["cue"], hazardLevels: { smoke: 4 }, availableResources: ["phone"], hintsUsed: 0 },
      eventLog: [{ kind: "action", sequence: 1, nodeId: "decision", actionId: "unsafe", safetyClass: "unsafe" }],
    } as unknown as SimulationState;
    const transfer = {
      world: { discoveredCueIds: ["cue"], hazardLevels: { smoke: 1 }, availableResources: ["phone"], hintsUsed: 0 },
      eventLog: [{ kind: "action", sequence: 1, nodeId: "decision", actionId: "safe", safetyClass: "safe" }],
    } as unknown as SimulationState;

    const result = scoreSimulation(primary, transfer, true);

    expect(result.transferSuccessful).toBe(true);
    expect(result.improved).toBe(true);
    expect(result.scoreEligible).toBe(true);
    expect(result.overall).toBeGreaterThan(0);
  });
});
