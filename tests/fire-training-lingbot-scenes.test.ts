import { describe, expect, it } from "vitest";
import {
  FIRE_INITIAL_SCENE,
  FIRE_RECOVERY_SCENE,
  FIRE_SAFE_SCENE,
  FIRE_UNSAFE_SCENE,
  sceneForFireAction,
} from "../lib/fire-training/lingbot-scenes";

describe("fire LingBot scenes", () => {
  it("uses one fixed checkpoint seed for both futures", () => {
    expect(FIRE_UNSAFE_SCENE.seed).toBe(FIRE_SAFE_SCENE.seed);
  });

  it("changes only the branch delta between counterfactual futures", () => {
    expect(FIRE_UNSAFE_SCENE.invariantPrompt).toBe(FIRE_SAFE_SCENE.invariantPrompt);
    expect(FIRE_UNSAFE_SCENE.branchPrompt).not.toBe(FIRE_SAFE_SCENE.branchPrompt);
  });

  it("maps reviewed door actions to the correct scene", () => {
    expect(sceneForFireAction("OpenDoor").id).toBe("fire-door-open");
    expect(sceneForFireAction("KeepDoorClosed").id).toBe("fire-door-closed");
    expect(sceneForFireAction("CloseDoor").id).toBe("fire-door-reclosed");
  });

  it("defines a stable post-transition state for every door branch", () => {
    expect(FIRE_UNSAFE_SCENE.settledPrompt).toContain("remains fully open");
    expect(FIRE_SAFE_SCENE.settledPrompt).toContain("remains fully closed");
    expect(FIRE_RECOVERY_SCENE.settledPrompt).toContain("remains fully closed");
  });

  it("forbids text, people, extra exits and invented advice in every scene", () => {
    for (const scene of [FIRE_INITIAL_SCENE, FIRE_UNSAFE_SCENE, FIRE_SAFE_SCENE, FIRE_RECOVERY_SCENE]) {
      expect(scene.forbiddenVisualFacts).toEqual(expect.arrayContaining([
        "people", "captions or readable text", "additional doors or exits", "model-generated safety advice",
      ]));
    }
  });
});
