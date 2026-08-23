import { describe, expect, it } from "vitest";
import { preparedAssetForFireAction } from "../lib/fire-training/visual-continuation";

describe("prepared fire continuations", () => {
  it("uses the unsafe continuation after opening or exposing the door", () => {
    expect(preparedAssetForFireAction("OpenDoor")).toBe("/fallbacks/fire-hallway-unsafe.mp4");
    expect(preparedAssetForFireAction("CrouchLow")).toBe("/fallbacks/fire-hallway-unsafe.mp4");
  });

  it("uses the safe continuation after closing the door", () => {
    expect(preparedAssetForFireAction("CloseDoor")).toBe("/fallbacks/fire-shelter-safe.mp4");
  });

  it("does not replace the live stream for non-critical local actions", () => {
    expect(preparedAssetForFireAction("KeepDoorClosed")).toBeNull();
    expect(preparedAssetForFireAction("UsePhone")).toBeNull();
  });
});
