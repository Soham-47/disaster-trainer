import { describe, expect, it } from "vitest";
import { simulationReducer, createSimulationState } from "../lib/player/simulation-reducer";
import type { EpisodeGraph } from "../lib/scenario/types";

const episode: EpisodeGraph = {
  id: "test-episode",
  version: "1",
  disasterType: "structure_fire",
  startNodeId: "start",
  transferEpisodeId: "transfer",
  sourceReferences: [{ title: "Source", organization: "Test", url: "https://example.com", reviewedAt: "2026-08-23" }],
  cues: [],
  hints: [{ id: "hint-1", tier: 1, text: "Look for the warning cue." }],
  debrief: {
    warningCue: "warning",
    recommendedAction: "act safely",
    principle: "notice cues",
    source: { title: "Source", organization: "Test", url: "https://example.com", reviewedAt: "2026-08-23" },
  },
  nodes: {
    start: {
      id: "start", kind: "interaction", title: "Start", immediatePriority: "Inspect",
      scene: { referenceImage: "/references/bedroom-fire.jpg", seed: 1, invariantPrompt: "room", deltaPrompt: "still", requiredFacts: [], forbiddenFacts: [], cameraPreset: [], attentionWindow: "small", fallbackAsset: "/fallbacks/fire-bedroom-orient.mp4" },
      cueIds: [], checkpoint: false, hintIds: ["hint-1"],
      interactions: [{ id: "inspect-door", verb: "inspect", targetId: "door", label: "Inspect door", aliases: ["check door"], safetyClass: "conditional", nextNodeId: "choice", stateChanges: [{ key: "doorInspected", value: true }] }],
    },
    choice: {
      id: "choice", kind: "checkpoint", title: "Choice", immediatePriority: "Choose",
      scene: { referenceImage: "/references/bedroom-fire.jpg", seed: 2, invariantPrompt: "room", deltaPrompt: "door warm", requiredFacts: [], forbiddenFacts: [], cameraPreset: [], attentionWindow: "small", fallbackAsset: "/fallbacks/fire-bedroom-orient.mp4" },
      cueIds: [], checkpoint: true, hintIds: [],
      interactions: [
        { id: "safe-action", verb: "wait", targetId: "door", label: "Keep it closed", aliases: ["keep closed"], safetyClass: "safe", nextNodeId: "complete", stateChanges: [{ key: "hazard.smoke", value: 1 }] },
        { id: "unsafe-action", verb: "move", targetId: "hallway", label: "Open it", aliases: ["open door"], safetyClass: "unsafe", nextNodeId: "complete", stateChanges: [{ key: "hazard.smoke", value: 4 }] },
      ],
    },
    complete: {
      id: "complete", kind: "complete", title: "Complete", immediatePriority: "Debrief", scene: { referenceImage: "/references/bedroom-fire.jpg", seed: 3, invariantPrompt: "room", deltaPrompt: "outcome", requiredFacts: [], forbiddenFacts: [], cameraPreset: [], attentionWindow: "small", fallbackAsset: "/fallbacks/fire-bedroom-orient.mp4" }, cueIds: [], interactions: [], checkpoint: false, hintIds: [],
    },
  },
};

describe("simulation reducer", () => {
  it("accepts only current-node interactions and transitions deterministically", () => {
    let state = createSimulationState();
    state = simulationReducer(state, { type: "START_EPISODE", graph: episode });
    state = simulationReducer(state, { type: "SUBMIT_ACTION", intent: { verb: "inspect", targetId: "door", source: "hotspot" } });

    expect(state.world?.nodeId).toBe("choice");
    expect(state.world?.variables).toEqual({ doorInspected: true });
    expect(state.eventLog[0]).toMatchObject({ actionId: "inspect-door", safetyClass: "conditional", sequence: 1 });
  });

  it("ignores actions that are unavailable at the current node", () => {
    let state = simulationReducer(createSimulationState(), { type: "START_EPISODE", graph: episode });
    const next = simulationReducer(state, { type: "SUBMIT_ACTION", intent: { verb: "move", targetId: "hallway", source: "text" } });

    expect(next).toEqual(state);
  });

  it("applies unsafe hazard changes without ending the scenario early", () => {
    let state = createSimulationState();
    state = simulationReducer(state, { type: "START_EPISODE", graph: episode });
    state = simulationReducer(state, { type: "SUBMIT_ACTION", intent: { verb: "inspect", targetId: "door", source: "hotspot" } });
    state = simulationReducer(state, { type: "SUBMIT_ACTION", intent: { verb: "move", targetId: "hallway", source: "hotspot" } });

    expect(state.world?.hazardLevels.smoke).toBe(4);
    expect(state.world?.status).toBe("complete");
    expect(state.eventLog[1].safetyClass).toBe("unsafe");
  });

  it("restores an exact serializable checkpoint", () => {
    let state = createSimulationState();
    state = simulationReducer(state, { type: "START_EPISODE", graph: episode });
    state = simulationReducer(state, { type: "SAVE_CHECKPOINT", checkpoint: { id: "cp-1", nodeId: "start", frameDataUrl: "data:image/png;base64,frame", worldState: state.world!, createdAt: 1 } });
    state = simulationReducer(state, { type: "START_REWIND" });
    state = simulationReducer(state, { type: "RESTORE_CHECKPOINT", checkpointId: "cp-1" });

    expect(state.world).toEqual(state.checkpoints["cp-1"].worldState);
    expect(state.world?.status).toBe("active");
  });

  it("counts hints without changing safety state", () => {
    let state = simulationReducer(createSimulationState(), { type: "START_EPISODE", graph: episode });
    const next = simulationReducer(state, { type: "REQUEST_HINT", hintId: "hint-1" });

    expect(next.world?.hintsUsed).toBe(1);
    expect(next.world?.nodeId).toBe(state.world?.nodeId);
    expect(next.eventLog[0]).toMatchObject({ kind: "hint", sequence: 1 });
  });
});
