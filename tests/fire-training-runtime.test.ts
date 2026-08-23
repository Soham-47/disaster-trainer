import { describe, expect, it } from "vitest";
import { createFireRuntime, fireRuntimeReducer } from "../lib/fire-training/runtime";

function reachDecision() {
  let state = fireRuntimeReducer(createFireRuntime(), { type: "LIVE_READY" });
  for (const action of ["ListenAlarm", "InspectSmoke", "FeelDoor"] as const) {
    state = fireRuntimeReducer(state, { type: "LOCAL_ACTION", action });
  }
  return state;
}

describe("fire runtime", () => {
  it("does not commit a branch action before its render receipt", () => {
    let state = reachDecision();
    state = fireRuntimeReducer(state, {
      type: "CHECKPOINT_READY",
      checkpointId: "fire-door-checkpoint",
    });
    state = fireRuntimeReducer(state, {
      type: "BRANCH_REQUESTED",
      jobId: 7,
      action: "OpenDoor",
    });

    expect(state.training.initialDecision).toBeNull();
    expect(state.pendingAction).toEqual({ jobId: 7, action: "OpenDoor" });

    state = fireRuntimeReducer(state, {
      type: "BRANCH_RENDERED",
      receipt: { jobId: 7, firstChunkIndex: 1, startedAt: 100, firstFrameAt: 140 },
    });
    expect(state.training.initialDecision).toBe("OpenDoor");
    expect(state.phase).toBe("consequence");
  });

  it("ignores stale render receipts", () => {
    let state = reachDecision();
    state = fireRuntimeReducer(state, { type: "CHECKPOINT_READY", checkpointId: "cp" });
    state = fireRuntimeReducer(state, { type: "BRANCH_REQUESTED", jobId: 9, action: "KeepDoorClosed" });
    const stale = fireRuntimeReducer(state, {
      type: "BRANCH_RENDERED",
      receipt: { jobId: 8, firstChunkIndex: 1, startedAt: 100, firstFrameAt: 140 },
    });
    expect(stale).toEqual(state);
  });

  it("keeps the decision retryable after a branch failure", () => {
    let state = reachDecision();
    state = fireRuntimeReducer(state, { type: "CHECKPOINT_READY", checkpointId: "cp" });
    state = fireRuntimeReducer(state, { type: "BRANCH_REQUESTED", jobId: 3, action: "OpenDoor" });
    state = fireRuntimeReducer(state, { type: "BRANCH_FAILED", jobId: 3, message: "first frame timeout" });
    expect(state.training.initialDecision).toBeNull();
    expect(state.phase).toBe("decision_ready");
    expect(state.error).toBe("first frame timeout");
  });

  it("commits the alternative only after its matching render receipt", () => {
    let state = reachDecision();
    state = fireRuntimeReducer(state, { type: "CHECKPOINT_READY", checkpointId: "cp" });
    state = fireRuntimeReducer(state, { type: "BRANCH_REQUESTED", jobId: 4, action: "KeepDoorClosed" });
    state = fireRuntimeReducer(state, {
      type: "BRANCH_RENDERED",
      receipt: { jobId: 4, firstChunkIndex: 1, startedAt: 100, firstFrameAt: 140 },
    });
    state = fireRuntimeReducer(state, { type: "START_ALTERNATIVE" });
    expect(state.phase).toBe("alternative");
    expect(state.training.stage).toBe("counterfactual-decision");
    expect(state.training.alternativeDecision).toBeNull();
    state = fireRuntimeReducer(state, { type: "ALTERNATIVE_REQUESTED", jobId: 5, action: "OpenDoor" });
    expect(state.training.alternativeDecision).toBeNull();
    state = fireRuntimeReducer(state, {
      type: "ALTERNATIVE_RENDERED",
      receipt: { jobId: 5, firstChunkIndex: 1, startedAt: 200, firstFrameAt: 250 },
    });
    expect(state.training.alternativeDecision).toBe("OpenDoor");
    expect(state.phase).toBe("alternative");
  });

  it("does not let a branch receipt commit an alternative job", () => {
    let state = reachDecision();
    state = fireRuntimeReducer(state, { type: "CHECKPOINT_READY", checkpointId: "cp" });
    state = fireRuntimeReducer(state, { type: "BRANCH_REQUESTED", jobId: 4, action: "KeepDoorClosed" });
    state = fireRuntimeReducer(state, {
      type: "BRANCH_RENDERED",
      receipt: { jobId: 4, firstChunkIndex: 1, startedAt: 100, firstFrameAt: 140 },
    });
    state = fireRuntimeReducer(state, { type: "START_ALTERNATIVE" });
    state = fireRuntimeReducer(state, { type: "ALTERNATIVE_REQUESTED", jobId: 5, action: "OpenDoor" });

    const stale = fireRuntimeReducer(state, {
      type: "BRANCH_RENDERED",
      receipt: { jobId: 5, firstChunkIndex: 1, startedAt: 200, firstFrameAt: 250 },
    });
    expect(stale).toEqual(state);
  });

  it("keeps an alternative retryable after its render failure", () => {
    let state = reachDecision();
    state = fireRuntimeReducer(state, { type: "CHECKPOINT_READY", checkpointId: "cp" });
    state = fireRuntimeReducer(state, { type: "BRANCH_REQUESTED", jobId: 4, action: "KeepDoorClosed" });
    state = fireRuntimeReducer(state, {
      type: "BRANCH_RENDERED",
      receipt: { jobId: 4, firstChunkIndex: 1, startedAt: 100, firstFrameAt: 140 },
    });
    state = fireRuntimeReducer(state, { type: "START_ALTERNATIVE" });
    state = fireRuntimeReducer(state, { type: "ALTERNATIVE_REQUESTED", jobId: 5, action: "OpenDoor" });
    const beforeFailure = state.training;
    state = fireRuntimeReducer(state, { type: "BRANCH_FAILED", jobId: 5, message: "first frame timeout" });

    expect(state.training).toEqual(beforeFailure);
    expect(state.phase).toBe("alternative");
    expect(state.error).toBe("first frame timeout");

    state = fireRuntimeReducer(state, { type: "ALTERNATIVE_REQUESTED", jobId: 6, action: "OpenDoor" });
    expect(state.pendingAction).toEqual({ jobId: 6, action: "OpenDoor" });
  });

  it("does not commit CrouchLow before its matching render receipt", () => {
    let state = reachDecision();
    state = fireRuntimeReducer(state, { type: "CHECKPOINT_READY", checkpointId: "cp" });
    state = fireRuntimeReducer(state, { type: "BRANCH_REQUESTED", jobId: 6, action: "OpenDoor" });
    state = fireRuntimeReducer(state, {
      type: "BRANCH_RENDERED",
      receipt: { jobId: 6, firstChunkIndex: 1, startedAt: 100, firstFrameAt: 140 },
    });

    expect(fireRuntimeReducer(state, { type: "LOCAL_ACTION", action: "CrouchLow" })).toEqual(state);
    state = fireRuntimeReducer(state, { type: "BRANCH_REQUESTED", jobId: 7, action: "CrouchLow" });
    expect(state.training.exposure).toBe(65);
    expect(state.pendingAction).toEqual({ jobId: 7, action: "CrouchLow" });

    state = fireRuntimeReducer(state, {
      type: "BRANCH_RENDERED",
      receipt: { jobId: 7, firstChunkIndex: 1, startedAt: 200, firstFrameAt: 250 },
    });
    expect(state.training.exposure).toBe(55);
  });

  it("ignores stale render receipts for CrouchLow", () => {
    let state = reachDecision();
    state = fireRuntimeReducer(state, { type: "CHECKPOINT_READY", checkpointId: "cp" });
    state = fireRuntimeReducer(state, { type: "BRANCH_REQUESTED", jobId: 6, action: "OpenDoor" });
    state = fireRuntimeReducer(state, {
      type: "BRANCH_RENDERED",
      receipt: { jobId: 6, firstChunkIndex: 1, startedAt: 100, firstFrameAt: 140 },
    });
    state = fireRuntimeReducer(state, { type: "BRANCH_REQUESTED", jobId: 7, action: "CrouchLow" });

    const stale = fireRuntimeReducer(state, {
      type: "BRANCH_RENDERED",
      receipt: { jobId: 8, firstChunkIndex: 1, startedAt: 200, firstFrameAt: 250 },
    });
    expect(stale).toEqual(state);
  });

  it("ignores invalid alternative requests", () => {
    let state = reachDecision();
    state = fireRuntimeReducer(state, { type: "CHECKPOINT_READY", checkpointId: "cp" });
    state = fireRuntimeReducer(state, { type: "BRANCH_REQUESTED", jobId: 4, action: "KeepDoorClosed" });
    state = fireRuntimeReducer(state, {
      type: "BRANCH_RENDERED",
      receipt: { jobId: 4, firstChunkIndex: 1, startedAt: 100, firstFrameAt: 140 },
    });

    expect(fireRuntimeReducer(state, {
      type: "ALTERNATIVE_REQUESTED",
      jobId: 5,
      action: "KeepDoorClosed",
    })).toEqual(state);
    expect(fireRuntimeReducer(state, {
      type: "ALTERNATIVE_REQUESTED",
      jobId: 5,
      action: "CloseDoor",
    })).toEqual(state);
  });

  it("keeps CloseDoor pending until its matching render receipt", () => {
    let state = reachDecision();
    state = fireRuntimeReducer(state, { type: "CHECKPOINT_READY", checkpointId: "cp" });
    state = fireRuntimeReducer(state, { type: "BRANCH_REQUESTED", jobId: 6, action: "OpenDoor" });
    state = fireRuntimeReducer(state, {
      type: "BRANCH_RENDERED",
      receipt: { jobId: 6, firstChunkIndex: 1, startedAt: 100, firstFrameAt: 140 },
    });
    state = fireRuntimeReducer(state, { type: "BRANCH_REQUESTED", jobId: 7, action: "CrouchLow" });
    state = fireRuntimeReducer(state, {
      type: "BRANCH_RENDERED",
      receipt: { jobId: 7, firstChunkIndex: 1, startedAt: 200, firstFrameAt: 250 },
    });
    state = fireRuntimeReducer(state, { type: "BRANCH_REQUESTED", jobId: 8, action: "CloseDoor" });

    expect(state.training.completedActions).not.toContain("CloseDoor");
    state = fireRuntimeReducer(state, {
      type: "BRANCH_RENDERED",
      receipt: { jobId: 8, firstChunkIndex: 1, startedAt: 300, firstFrameAt: 350 },
    });
    expect(state.training.completedActions).toContain("CloseDoor");
  });
});
