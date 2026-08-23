import { describe, expect, it } from "vitest";
import {
  composeScenarioFromDescription,
  detectDisasterType,
  getScenarioPack,
  resolveScenarioSelection,
  SUPPORTED_DISASTER_TYPES,
} from "../lib/scenario/registry";

describe("scenario registry", () => {
  it.each([
    ["Night earthquake in a high-rise", "earthquake"],
    ["Flash flood rising through an underground station", "flash_flood"],
    ["Wildfire smoke reaches a hillside home", "wildfire"],
    ["Cyclone winds batter a coastal apartment", "cyclone"],
    ["A bedroom fire with smoke under the door", "structure_fire"],
  ])("detects %s as %s", (description, expected) => {
    expect(detectDisasterType(description)).toBe(expected);
  });

  it("does not silently map an unsupported disaster to fire", () => {
    expect(detectDisasterType("A volcanic eruption near a village")).toBeNull();
    expect(composeScenarioFromDescription("A volcanic eruption near a village")).toBeNull();
  });

  it("registers five supported disaster families", () => {
    expect(SUPPORTED_DISASTER_TYPES).toHaveLength(5);
    for (const disasterType of SUPPORTED_DISASTER_TYPES) {
      expect(getScenarioPack(disasterType)?.disasterType).toBe(disasterType);
    }
  });

  it("composes a primary and transfer scenario from one learner description", () => {
    const selection = resolveScenarioSelection("Night earthquake in a high-rise");

    expect(selection?.scenario.parameters.disasterType).toBe("earthquake");
    expect(selection?.transferScenario.parameters.disasterType).toBe("earthquake");
    expect(selection?.scenario.basePrompt).toContain("earthquake");
    expect(selection?.transferScenario.id).not.toBe(selection?.scenario.id);
  });
});

