import { describe, expect, it } from "vitest";
import { composeEpisode } from "../lib/scenario/engine";
import { validateEpisodeGraph } from "../lib/scenario/episode-validation";
import type { EpisodeGraph } from "../lib/scenario/types";

const graph: EpisodeGraph = {
  id: "fire-demo",
  version: "1",
  disasterType: "structure_fire",
  startNodeId: "start",
  transferEpisodeId: "fire-transfer",
  sourceReferences: [
    {
      title: "Source",
      organization: "Reviewer",
      url: "https://example.com/source",
      reviewedAt: "2026-08-23",
    },
  ],
  cues: [],
  hints: [],
  debrief: {
    warningCue: "smoke",
    recommendedAction: "keep the door closed",
    principle: "check the cue before acting",
    source: {
      title: "Source",
      organization: "Reviewer",
      url: "https://example.com/source",
      reviewedAt: "2026-08-23",
    },
  },
  nodes: {
    start: {
      id: "start",
      kind: "explore",
      title: "Start",
      immediatePriority: "Look around",
      scene: {
        referenceImage: "/references/bedroom-fire.jpg",
        seed: 1,
        invariantPrompt: "A stable first-person room",
        deltaPrompt: "No visual change",
        requiredFacts: [],
        forbiddenFacts: [],
        cameraPreset: [],
        attentionWindow: "small",
        fallbackAsset: "/fallbacks/fire-bedroom-orient.mp4",
      },
      cueIds: [],
      interactions: [
        {
          id: "inspect-door",
          verb: "inspect",
          targetId: "door",
          label: "Inspect the door",
          aliases: ["check the door"],
          safetyClass: "conditional",
          nextNodeId: "checkpoint",
          stateChanges: [],
        },
      ],
      checkpoint: false,
      hintIds: [],
    },
    checkpoint: {
      id: "checkpoint",
      kind: "checkpoint",
      title: "Decision",
      immediatePriority: "Choose carefully",
      scene: {
        referenceImage: "/references/bedroom-fire.jpg",
        seed: 1,
        invariantPrompt: "A stable first-person room",
        deltaPrompt: "The door remains closed",
        requiredFacts: [],
        forbiddenFacts: [],
        cameraPreset: [],
        attentionWindow: "small",
        fallbackAsset: "/fallbacks/fire-bedroom-orient.mp4",
      },
      cueIds: [],
      interactions: [],
      checkpoint: true,
      hintIds: [],
    },
  },
};

describe("episode graph validation", () => {
  it("accepts a reachable graph with a valid start node", () => {
    expect(validateEpisodeGraph(graph)).toEqual({ valid: true, errors: [] });
  });

  it("rejects an interaction whose target node does not exist", () => {
    const invalid = structuredClone(graph);
    invalid.nodes.start.interactions[0].nextNodeId = "missing";

    expect(validateEpisodeGraph(invalid)).toEqual({
      valid: false,
      errors: ["Interaction inspect-door points to missing node missing"],
    });
  });

  it("rejects an unreachable node", () => {
    const invalid = structuredClone(graph);
    invalid.nodes.orphan = {
      ...invalid.nodes.checkpoint,
      id: "orphan",
    };

    expect(validateEpisodeGraph(invalid)).toEqual({
      valid: false,
      errors: ["Node orphan is unreachable from start node start"],
    });
  });

  it("composes the same episode deterministically", () => {
    expect(composeEpisode(graph)).toEqual(composeEpisode(graph));
  });
});
