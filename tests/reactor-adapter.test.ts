import { describe, it, expect, beforeEach, vi } from "vitest";
import { ReactorClient } from "../lib/reactor/client";

describe("ReactorClient Adapter", () => {
  let client: ReactorClient;

  beforeEach(() => {
    client = new ReactorClient();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: "rtk_test_mock_token_12345",
        expiresAt: Date.now() + 3600000,
        endpoint: "wss://api.reactor.inc/v1/test",
      }),
    }));
  });

  it("should initialize with idle status", () => {
    expect(client.getStatus()).toBe("idle");
    expect(client.getMode()).toBe("live");
  });

  it("should transition through status states during start()", async () => {
    const statusHistory: string[] = [];
    client.onStatus((status) => statusHistory.push(status));

    await client.start({
      referenceImage: "/references/bedroom-fire.jpg",
      prompt: "A bedroom with dark smoke under the exit door",
      seed: 12345,
    });

    expect(statusHistory).toContain("connecting");
    expect(statusHistory).toContain("uploading_image");
    expect(statusHistory).toContain("ready");
    expect(statusHistory).toContain("generating");
    expect(client.getStatus()).toBe("generating");
  });

  it("should transition to fallback mode when useFallback is called", async () => {
    let triggered = false;
    client.on("fallback_triggered", () => {
      triggered = true;
    });

    await client.useFallback("/fallbacks/fire-bedroom-orient.mp4");

    expect(client.getStatus()).toBe("fallback");
    expect(client.getMode()).toBe("fallback");
    expect(client.getActiveFallbackAsset()).toBe("/fallbacks/fire-bedroom-orient.mp4");
    expect(triggered).toBe(true);
  });

  it("should pause and resume stream cleanly", async () => {
    await client.start({
      referenceImage: "/references/bedroom-fire.jpg",
      prompt: "Testing pause resume",
      seed: 999,
    });

    await client.pause();
    expect(client.getStatus()).toBe("paused");

    await client.resume();
    expect(client.getStatus()).toBe("generating");
  });

  it("should store and retrieve captured decision frames", () => {
    const testFrame = "data:image/jpeg;base64,mockframedata";
    client.setCapturedFrame(testFrame);
    expect(client.getCapturedFrame()).toBe(testFrame);
  });
});
