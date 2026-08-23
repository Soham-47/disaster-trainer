import { describe, expect, it } from "vitest";
import { createTimingMetrics, durationBetween, recordStage } from "../lib/lingbot/metrics";

describe("LingBot timing metrics", () => {
  it("measures branch request to first frame", () => {
    let metrics = createTimingMetrics();
    metrics = recordStage(metrics, "branch_requested", 1000);
    metrics = recordStage(metrics, "first_frame", 7250);
    expect(durationBetween(metrics, "branch_requested", "first_frame")).toBe(6250);
  });
  it("returns null when either stage is missing", () => {
    expect(durationBetween(createTimingMetrics(), "branch_requested", "first_frame")).toBeNull();
  });
});
