import { describe, expect, it } from "vitest";
import { FIRE_ACTIONS, isFireAction } from "../lib/fire-training/actions";

describe("fire training actions", () => {
  it("defines the reviewed action vocabulary independently of a renderer", () => {
    expect(FIRE_ACTIONS).toEqual([
      "ListenAlarm",
      "InspectSmoke",
      "FeelDoor",
      "OpenDoor",
      "CloseDoor",
      "KeepDoorClosed",
      "UsePhone",
      "SignalWindow",
      "CrouchLow",
    ]);
    expect(isFireAction("OpenDoor")).toBe(true);
    expect(isFireAction("Attack")).toBe(false);
  });
});
