import { describe, expect, it } from "vitest";
import { resolveActionIntent } from "../lib/player/action-resolver";
import type { EpisodeNode } from "../lib/scenario/types";

const node: EpisodeNode = {
  id: "room",
  kind: "interaction",
  title: "Room",
  immediatePriority: "Inspect the exit",
  scene: {
    referenceImage: "/references/bedroom-fire.jpg",
    seed: 1,
    invariantPrompt: "room",
    deltaPrompt: "still",
    requiredFacts: [],
    forbiddenFacts: [],
    cameraPreset: [],
    attentionWindow: "small",
    fallbackAsset: "/fallbacks/fire-bedroom-orient.mp4",
  },
  cueIds: [],
  checkpoint: false,
  hintIds: [],
  interactions: [
    { id: "inspect-door", verb: "inspect", targetId: "door", label: "Inspect the door", aliases: ["check the door", "look at the door"], safetyClass: "conditional", nextNodeId: "next", stateChanges: [] },
    { id: "inspect-window", verb: "inspect", targetId: "window", label: "Inspect the window", aliases: ["check the window", "look at the window"], safetyClass: "conditional", nextNodeId: "next", stateChanges: [] },
  ],
};

describe("constrained action resolver", () => {
  it("maps an exact alias to the reviewed interaction", () => {
    expect(resolveActionIntent(node, "  CHECK the door! ")).toEqual({
      kind: "match",
      intent: { verb: "inspect", targetId: "door", source: "text" },
      interactionId: "inspect-door",
    });
  });

  it("returns suggestions for an ambiguous command", () => {
    const result = resolveActionIntent(node, "check");
    expect(result.kind).toBe("ambiguous");
    if (result.kind === "ambiguous") expect(result.suggestions).toEqual(["Inspect the door", "Inspect the window"]);
  });

  it("does not invent an action outside the current node", () => {
    expect(resolveActionIntent(node, "run outside")).toEqual({
      kind: "unavailable",
      message: "That action is not available here.",
    });
  });
});
