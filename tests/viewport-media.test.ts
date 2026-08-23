import { describe, expect, it } from "vitest";
import { getViewportMediaMode } from "../lib/player/viewport-media";

describe("viewport media state", () => {
  it("does not render a synthetic disaster while live LingBot video is missing", () => {
    expect(getViewportMediaMode({ mode: "live", liveStream: false, liveVideoReady: false, fallbackAsset: null })).toBe("waiting");
  });

  it("renders prepared SVG fallbacks as images", () => {
    expect(getViewportMediaMode({ mode: "fallback", liveStream: false, liveVideoReady: false, fallbackAsset: "/fallbacks/earthquake-room.svg" })).toBe("fallback-image");
  });

  it("keeps prepared video fallbacks as video", () => {
    expect(getViewportMediaMode({ mode: "fallback", liveStream: false, liveVideoReady: false, fallbackAsset: "/fallbacks/fire-bedroom-orient.mp4" })).toBe("fallback-video");
  });
});

