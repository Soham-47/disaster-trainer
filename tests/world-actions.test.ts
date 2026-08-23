import { describe, expect, it } from "vitest";
import { MockWorldModelAdapter } from "../lib/player/mock-adapter";
import { playAlternative, playConsequence } from "../lib/player/world-actions";

describe("world action sequencing", () => {
  it("changes the initial consequence prompt without resuming an active stream", async () => {
    const adapter = new MockWorldModelAdapter(0);
    await adapter.start({ referenceImage: "/references/bedroom-fire.jpg", prompt: "orient", seed: 1 });

    await playConsequence(adapter, "the hallway is filled with smoke");

    expect(adapter.getStatus()).toBe("generating");
  });

  it("resumes only after a rewind when playing the alternative", async () => {
    const adapter = new MockWorldModelAdapter(0);
    await adapter.start({ referenceImage: "/references/bedroom-fire.jpg", prompt: "orient", seed: 1 });
    await adapter.pause();

    await playAlternative(adapter, "the door remains closed");

    expect(adapter.getStatus()).toBe("generating");
  });
});
