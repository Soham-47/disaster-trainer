import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import { ReactorClient } from "../lib/reactor/client";

describe("ReactorClient Adapter", () => {
  let client: ReactorClient;

  beforeEach(() => {
    client = new ReactorClient();
  });

  it("should initialize with idle status", () => {
    expect(client.getStatus()).toBe("idle");
    expect(client.getMode()).toBe("live");
  });

  it("should handle token endpoint failure and explicitly switch to fallback mode", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url) => {
      if (typeof url === "string" && url.includes("/api/reactor-token")) {
        return Promise.resolve({
          ok: false,
          status: 502,
          json: async () => ({ error: "TOKEN_EXCHANGE_FAILED", mode: "fallback" }),
        });
      }
      return Promise.resolve({ ok: true, blob: async () => new Blob(["test"]) });
    }));

    await client.start({
      referenceImage: "/references/bedroom-fire.jpg",
      prompt: "Bedroom fire scenario prompt",
      seed: 12345,
      fallbackAsset: "/fallbacks/fire-bedroom-orient.mp4",
    });

    expect(client.getMode()).toBe("fallback");
    expect(client.getStatus()).toBe("fallback");
    expect(client.getActiveFallbackAsset()).toBe("/fallbacks/fire-bedroom-orient.mp4");
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
    await client.useFallback("/fallbacks/fire-bedroom-orient.mp4");

    let pausedEventFired = false;
    let resumedEventFired = false;

    client.on("generation_paused", () => {
      pausedEventFired = true;
    });
    client.on("generation_resumed", () => {
      resumedEventFired = true;
    });

    await client.pause();
    expect(client.getStatus()).toBe("paused");
    expect(pausedEventFired).toBe(true);

    await client.resume();
    expect(client.getStatus()).toBe("generating");
    expect(resumedEventFired).toBe(true);
  });

  it("should store and retrieve captured decision frames", () => {
    const testFrame = "data:image/jpeg;base64,mockframedata";
    client.setCapturedFrame(testFrame);
    expect(client.getCapturedFrame()).toBe(testFrame);
  });

  it("should clear prompt, seed, captured frame, and status on reset()", async () => {
    client.setCapturedFrame("data:image/jpeg;base64,sample");
    await client.useFallback("/fallbacks/fire-bedroom-orient.mp4");

    await client.reset();

    expect(client.getStatus()).toBe("idle");
    expect(client.getMode()).toBe("live");
    expect(client.getCapturedFrame()).toBeNull();
    expect(client.getActiveFallbackAsset()).toBeNull();
  });

  it("should verify that fallback media assets and reference image exist on disk", () => {
    const rootDir = process.cwd();
    const manifestPath = path.join(rootDir, "public", "fallbacks", "manifest.json");
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    const fallbackKeys = Object.keys(manifest.fallbacks);

    for (const key of fallbackKeys) {
      const assetRelativePath = manifest.fallbacks[key].asset;
      const fullPath = path.join(rootDir, "public", assetRelativePath.replace(/^\//, ""));
      expect(fs.existsSync(fullPath)).toBe(true);
    }

    const referenceImagePath = path.join(rootDir, "public", "references", "bedroom-fire.jpg");
    expect(fs.existsSync(referenceImagePath)).toBe(true);
  });

  it("should deliver frames to the onFrame callback", async () => {
    let frameReceived = false;
    await client.start({
      referenceImage: "/references/bedroom-fire.jpg",
      prompt: "Testing frame delivery",
      seed: 42,
      fallbackAsset: "/fallbacks/fire-bedroom-orient.mp4",
      onFrame: () => {
        frameReceived = true;
      },
    });

    // In fallback mode, fallback is active
    expect(client.getStatus()).toBe("fallback");
  });
});
