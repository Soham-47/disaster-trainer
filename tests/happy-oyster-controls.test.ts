import { describe, expect, it } from "vitest";
import { directionFromKeys, lookFromMouseDelta } from "../lib/happy-oyster/controls";

describe("Happy Oyster controls", () => {
  it("maps simultaneous movement keys to the eight Adventure directions", () => {
    expect(directionFromKeys(new Set(["w"]))).toBe("Front");
    expect(directionFromKeys(new Set(["w", "d"]))).toBe("Front_Right");
    expect(directionFromKeys(new Set(["s", "a"]))).toBe("Back_Left");
    expect(directionFromKeys(new Set())).toBeNull();
  });

  it("quantizes mouse movement into a held look direction", () => {
    expect(lookFromMouseDelta(40, 0)).toBe("Mouse_Right");
    expect(lookFromMouseDelta(-40, -20)).toBe("Mouse_Up_Left");
    expect(lookFromMouseDelta(1, 1)).toBeNull();
  });
});
