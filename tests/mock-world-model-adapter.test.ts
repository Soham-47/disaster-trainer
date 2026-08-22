import { describe, expect, it, vi } from "vitest";
import { MockWorldModelAdapter } from "../lib/player/mock-adapter";

describe("MockWorldModelAdapter", () => {
  it("emits a generating status after start and supports the player controls", async () => {
    const adapter = new MockWorldModelAdapter(0);
    const statuses: string[] = [];
    adapter.onStatus((status) => statuses.push(status));

    await adapter.start({
      referenceImage: "/references/bedroom-fire.jpg",
      prompt: "mock orient",
      seed: 7,
    });
    expect(adapter.getStatus()).toBe("generating");

    await adapter.pause();
    expect(adapter.getStatus()).toBe("paused");

    await adapter.applyPrompt("mock consequence");
    await adapter.resume();
    expect(adapter.getStatus()).toBe("generating");
    expect(statuses).toEqual(["connecting", "generating", "paused", "generating"]);
  });

  it("switches to fallback and clears the live state", async () => {
    const adapter = new MockWorldModelAdapter(0);
    const frame = vi.fn();
    await adapter.start({
      referenceImage: "/references/bedroom-fire.jpg",
      prompt: "mock orient",
      seed: 7,
      onFrame: frame,
    });

    await adapter.useFallback("/fallbacks/fire-bedroom-orient.mp4");

    expect(adapter.getStatus()).toBe("fallback");
    expect(adapter.getMode()).toBe("fallback");
    expect(adapter.getActiveFallbackAsset()).toBe("/fallbacks/fire-bedroom-orient.mp4");
    expect(frame).toHaveBeenLastCalledWith(null);
  });
});
