import { describe, expect, it } from "vitest";
import {
  composeScenario,
  validateScenarioParameters,
  validateScenarioPack,
} from "../lib/scenario/engine";
import { structureFirePack } from "../scenarios/structure-fire-v1";

const validParameters = {
  disasterType: "structure_fire" as const,
  environment: "apartment" as const,
  timeOfDay: "night" as const,
  occupancy: "alone" as const,
  mobilityConstraint: "none" as const,
  infrastructureState: "normal" as const,
  severity: "active_danger" as const,
};

describe("structure-fire scenario engine", () => {
  it("composes the same approved scenario deterministically", () => {
    const first = composeScenario(structureFirePack, validParameters);
    const second = composeScenario(structureFirePack, validParameters);

    expect(first).toEqual(second);
    expect(first.validationStatus).toBe("approved");
    expect(first.basePrompt).toContain("apartment");
    expect(first.orientFallbackAsset).toBe("/fallbacks/fire-bedroom-orient.mp4");
    expect(first.basePrompt).toContain("night");
    expect(first.decision.choices).toHaveLength(2);
  });

  it("rejects a parameter value outside the reviewed pack", () => {
    const result = validateScenarioParameters(structureFirePack, {
      ...validParameters,
      environment: "shopping_mall",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("environment");
  });

  it("rejects a forbidden parameter combination before prompt composition", () => {
    const result = validateScenarioParameters(structureFirePack, {
      ...validParameters,
      infrastructureState: "blocked_exit",
      severity: "early_warning",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("forbidden");
  });

  it("validates the pack's controlled choices, consequences, and source", () => {
    const result = validateScenarioPack(structureFirePack);

    expect(result).toEqual({ valid: true, errors: [] });
  });
});
