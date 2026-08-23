import { beforeEach, describe, expect, it, vi } from "vitest";

const { calls, streamState, events, FakeHappyOysterModel } = vi.hoisted(() => {
  const hoistedCalls: Array<[string, unknown?]> = [];
  const hoistedStreamState = { streaming: true };
  const hoistedEvents: {
    phase?: (phase: string) => void;
    travelStatus?: (status: string) => void;
    travelError?: (error: unknown) => void;
  } = {};

  class HoistedFakeHappyOysterModel {
    phase = "idle";
    private phaseHandler?: (phase: string) => void;
    private travelStateHandler?: (state: { environment_actions: string[]; character_actions: string[] }) => void;

    constructor(_options: unknown) {
      hoistedCalls.push(["construct"]);
    }

    onPhaseChanged(handler: (phase: string) => void) {
      this.phaseHandler = handler;
      hoistedEvents.phase = handler;
      return () => undefined;
    }

    onTravelState(handler: (state: { environment_actions: string[]; character_actions: string[] }) => void) {
      this.travelStateHandler = handler;
      return () => undefined;
    }

    onTravelError(_handler: (error: unknown) => void) {
      hoistedEvents.travelError = _handler;
      return () => undefined;
    }

    onTravelStatusChanged(handler: (status: string) => void) {
      hoistedEvents.travelStatus = handler;
      return () => undefined;
    }

    async connect(token: string) {
      hoistedCalls.push(["connect", token]);
      this.phaseHandler?.("connected");
    }

    async attachWorld(worldId: string) {
      hoistedCalls.push(["attachWorld", worldId]);
      return { mode: 1, phase: "ready" };
    }

    async startTravel() {
      hoistedCalls.push(["startTravel"]);
      if (hoistedStreamState.streaming) {
        this.phaseHandler?.("streaming");
        this.travelStateHandler?.({
          environment_actions: ["open_close_door", "take_cover"],
          character_actions: ["crouch", "jump", "attack"],
        });
      }
      return {
        streaming: hoistedStreamState.streaming,
        session: hoistedStreamState.streaming ? { maxExperienceTimeSec: 120 } : null,
      };
    }

    async move(value: string) { hoistedCalls.push(["move", value]); }
    async look(value: string) { hoistedCalls.push(["look", value]); }
    async interact(value: string) { hoistedCalls.push(["interact", value]); }
    async control(value: unknown) { hoistedCalls.push(["control", value]); }
    async release(value: unknown) { hoistedCalls.push(["release", value]); }
    async stop() { hoistedCalls.push(["stop"]); }
    async endTravelSession() { hoistedCalls.push(["endTravelSession"]); }
    async disconnect() { hoistedCalls.push(["disconnect"]); }
  }

  return {
    calls: hoistedCalls,
    streamState: hoistedStreamState,
    events: hoistedEvents,
    FakeHappyOysterModel: HoistedFakeHappyOysterModel,
  };
});

vi.mock("@reactor-models/happy-oyster", () => ({ HappyOysterModel: FakeHappyOysterModel }));

import { HappyOysterFireClient } from "../lib/happy-oyster/fire-client";

describe("HappyOysterFireClient", () => {
  beforeEach(() => {
    calls.length = 0;
    streamState.streaming = true;
  });

  it("attaches the reviewed world and becomes live only after streaming starts", async () => {
    const client = new HappyOysterFireClient();
    const statuses: string[] = [];
    client.onStatus((status) => statuses.push(status));

    await client.start({ token: "jwt", worldId: "fire-world", videoElement: {} as HTMLVideoElement });

    expect(calls.slice(0, 4)).toEqual([
      ["construct"],
      ["connect", "jwt"],
      ["attachWorld", "fire-world"],
      ["startTravel"],
    ]);
    expect(statuses.at(-1)).toBe("live");
    expect(client.getAvailableActions()).toContain("open_close_door");
  });

  it("rejects a session that does not publish a live stream", async () => {
    streamState.streaming = false;
    const client = new HappyOysterFireClient();

    await expect(client.start({ token: "jwt", worldId: "fire-world", videoElement: {} as HTMLVideoElement }))
      .rejects.toThrow("did not publish a live stream");
    expect(client.getStatus()).toBe("error");
  });

  it("restarts travel on the same attached world and constrains interactions", async () => {
    const client = new HappyOysterFireClient();
    await client.start({ token: "jwt", worldId: "fire-world", videoElement: {} as HTMLVideoElement });

    await client.interact("OpenDoor");
    await client.approachAndInteract("OpenDoor", 0);
    await expect(client.interact("Attack" as never)).rejects.toThrow("not reviewed");
    await client.restartTravel();

    expect(calls).toContainEqual(["interact", "open_close_door"]);
    expect(calls).toContainEqual(["release", { interaction: true }]);
    expect(calls).toContainEqual(["move", "Front"]);
    expect(calls).toContainEqual(["release", { translation: true }]);
    expect(calls.filter(([name]) => name === "startTravel")).toHaveLength(2);
    expect(calls).toContainEqual(["endTravelSession"]);
  });

  it("exposes terminal travel states so the trainer can recover", async () => {
    const client = new HappyOysterFireClient();
    await client.start({ token: "jwt", worldId: "fire-world", videoElement: {} as HTMLVideoElement });

    events.travelStatus?.("completed");
    expect(client.getStatus()).toBe("ended");

    await client.start({ token: "jwt", worldId: "fire-world", videoElement: {} as HTMLVideoElement });
    events.travelError?.(new Error("stream failed"));
    expect(client.getStatus()).toBe("error");
  });
});
