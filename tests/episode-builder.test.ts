import { describe, expect, it } from "vitest";
import { composeEpisodeFromPack } from "../lib/scenario/episode-builder";
import { validateEpisodeGraph } from "../lib/scenario/episode-validation";
import { structureFirePack } from "../scenarios/structure-fire-v1";

const parameters = {
  disasterType: "structure_fire" as const,
  environment: "apartment" as const,
  timeOfDay: "night" as const,
  occupancy: "alone" as const,
  mobilityConstraint: "none" as const,
  infrastructureState: "normal" as const,
  severity: "active_danger" as const,
};

describe("reviewed pack episode builder", () => {
  it("builds a deep multi-step fire graph with reconverging branches", () => {
    const graph = composeEpisodeFromPack(structureFirePack, parameters);
    expect(validateEpisodeGraph(graph)).toEqual({ valid: true, errors: [] });
    expect(Object.keys(graph.nodes)).toEqual([
      "fire-orient",
      "fire-investigate-alarm",
      "fire-investigate-exit",
      "fire-assess-exit",
      "fire-consequence-safe",
      "fire-consequence-unsafe",
      "fire-recovery",
      "fire-outcome",
      "fire-debrief",
    ]);
    expect(graph.nodes["fire-assess-exit"].interactions).toHaveLength(2);
    expect(graph.nodes["fire-consequence-unsafe"].interactions[0].nextNodeId).toBe("fire-recovery");
    expect(graph.nodes["fire-consequence-safe"].interactions[0].nextNodeId).toBe("fire-outcome");
  });

  it("builds compact graphs for non-flagship packs using the same deterministic contract", () => {
    const graph = composeEpisodeFromPack(structureFirePack, parameters, { compact: true });
    expect(validateEpisodeGraph(graph)).toEqual({ valid: true, errors: [] });
    expect(Object.keys(graph.nodes)).toHaveLength(6);
  });

  it("anchors every generated scene to an upright text-free camera contract", () => {
    const graph = composeEpisodeFromPack(structureFirePack, parameters);

    for (const node of Object.values(graph.nodes)) {
      expect(node.scene.invariantPrompt).toContain("level horizon");
      expect(node.scene.invariantPrompt).toContain("no readable text");
      expect(node.scene.invariantPrompt).toContain("no camera roll");
    }
  });
});
