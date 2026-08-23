import { describe, expect, it } from "vitest";
import { navigationFromKeys } from "../lib/player/navigation";

describe("navigation key mapping", () => {
  it("maps WASD and arrow keys into a complete navigation state", () => {
    expect(navigationFromKeys(new Set(["w", "a", "ArrowLeft"]))).toEqual({
      forward: true,
      backward: false,
      left: true,
      right: false,
      lookHorizontal: "left",
      lookVertical: "idle",
    });
  });

  it("returns idle controls when no keys are pressed", () => {
    expect(navigationFromKeys(new Set())).toEqual({
      forward: false,
      backward: false,
      left: false,
      right: false,
      lookHorizontal: "idle",
      lookVertical: "idle",
    });
  });
});
