import { describe, expect, it } from "vitest";
import { parseIntent } from "../lib/player/intent-parser";
import type { EpisodeNode } from "../lib/scenario/types";

const node = {
  id: "room",
  kind: "interaction",
  title: "Room",
  immediatePriority: "Inspect",
  scene: {
    referenceImage: "/references/bedroom-fire.jpg", seed: 1, invariantPrompt: "room", deltaPrompt: "still",
    requiredFacts: [], forbiddenFacts: [], cameraPreset: [], attentionWindow: "small", fallbackAsset: "/fallbacks/fire-bedroom-orient.mp4",
  },
  cueIds: [], checkpoint: false, hintIds: [],
  interactions: [{ id: "door", verb: "inspect", targetId: "door", label: "Inspect the door", aliases: ["check the door"], safetyClass: "conditional", nextNodeId: "done", stateChanges: [] }],
} satisfies EpisodeNode;

describe("intent parser", () => {
  it("returns the reviewed intent and never a free-form model prompt", () => {
    const result = parseIntent(node, "check the door");
    expect(result).toEqual({ kind: "match", intent: { verb: "inspect", targetId: "door", source: "text" }, interactionId: "door" });
  });
});
