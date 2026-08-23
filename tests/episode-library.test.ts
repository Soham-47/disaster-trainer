import { describe, expect, it } from "vitest";
import { composeEpisodeFromPack } from "../lib/scenario/episode-builder";
import { validateEpisodeGraph } from "../lib/scenario/episode-validation";
import { getAllScenarioPacks } from "../lib/scenario/registry";
import { composeScenario } from "../lib/scenario/engine";
import type { ScenarioParameters } from "../lib/scenario/types";

describe("five-disaster episode library", () => {
  it("creates validated primary and transfer graphs for every reviewed pack", () => {
    for (const pack of getAllScenarioPacks()) {
      const parameters: ScenarioParameters = {
        disasterType: pack.disasterType,
        environment: pack.supportedParameters.environment?.[0] as ScenarioParameters["environment"],
        timeOfDay: pack.supportedParameters.timeOfDay?.[0] as ScenarioParameters["timeOfDay"],
        occupancy: pack.supportedParameters.occupancy?.[0] as ScenarioParameters["occupancy"],
        mobilityConstraint: pack.supportedParameters.mobilityConstraint?.[0] as ScenarioParameters["mobilityConstraint"],
        infrastructureState: pack.supportedParameters.infrastructureState?.[0] as ScenarioParameters["infrastructureState"],
        severity: pack.supportedParameters.severity?.[0] as ScenarioParameters["severity"],
      };
      const scenario = composeScenario(pack, parameters);
      const primary = composeEpisodeFromPack(pack, parameters);
      const transfer = composeEpisodeFromPack(pack, { ...parameters, environment: pack.supportedParameters.environment?.[0] as ScenarioParameters["environment"] }, { compact: true });

      expect(validateEpisodeGraph(primary), pack.id).toEqual({ valid: true, errors: [] });
      expect(validateEpisodeGraph(transfer), `${pack.id} transfer`).toEqual({ valid: true, errors: [] });
      expect(primary.disasterType).toBe(scenario.parameters.disasterType);
      expect(Object.keys(primary.nodes).length).toBeGreaterThanOrEqual(pack.disasterType === "structure_fire" || pack.disasterType === "earthquake" ? 9 : 6);
    }
  });
});
