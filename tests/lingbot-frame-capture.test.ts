import { describe, expect, it } from "vitest";
import { captureVideoFrame } from "../lib/lingbot/frame-capture";

function video(overrides: Partial<HTMLVideoElement> = {}): HTMLVideoElement {
  return { readyState: 2, videoWidth: 1920, videoHeight: 1080, ...overrides } as HTMLVideoElement;
}

describe("captureVideoFrame", () => {
  it("rejects video with zero dimensions", () => {
    expect(() => captureVideoFrame(video({ videoWidth: 0 }))).toThrow(/not ready/);
  });

  it("captures at 1280 by 720 with JPEG quality 0.82", () => {
    const calls: unknown[][] = [];
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: (...args: unknown[]) => calls.push(args) }),
      toDataURL: (...args: unknown[]) => { calls.push(args); return `data:image/jpeg;base64,${"x".repeat(100)}`; },
    } as unknown as HTMLCanvasElement;
    expect(captureVideoFrame(video(), () => canvas)).toContain("data:image/jpeg;base64,");
    expect(canvas.width).toBe(1280);
    expect(canvas.height).toBe(720);
    expect(calls[0]).toEqual([video(), 0, 0, 1280, 720]);
    expect(calls[1]).toEqual(["image/jpeg", 0.82]);
  });

  it("rejects an empty canvas result", () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: () => undefined }),
      toDataURL: () => "data:image/jpeg;base64,",
    } as unknown as HTMLCanvasElement;
    expect(() => captureVideoFrame(video(), () => canvas)).toThrow(/empty/);
  });
});
