import { describe, it, expect } from "vitest";
import {
  fireSpikeReducer,
  INITIAL_SPIKE_STATE,
  areCheckpointsEqual,
} from "../lib/renderer-spike/fire-spike-reducer";
import { RendererCheckpoint } from "../lib/renderer-spike/types";

describe("Renderer Checkpoint & Determinism Suite", () => {
  it("saves checkpoint and restores exact renderer and training state", () => {
    let state = INITIAL_SPIKE_STATE;

    // Simulate actions before checkpoint
    state = fireSpikeReducer(state, {
      type: "SET_PLAYER_TRANSFORM",
      position: [0.5, 1.05, -1.2],
      yaw: 0.4,
      pitch: -0.2,
    });
    state = fireSpikeReducer(state, { type: "SET_CROUCH", crouched: true });
    state = fireSpikeReducer(state, {
      type: "EXECUTE_INTERACTION",
      objectId: "bedroom-door",
      interaction: "feel-door",
    });

    // Save checkpoint at decision point
    state = fireSpikeReducer(state, { type: "SAVE_CHECKPOINT" });
    const savedCheckpoint = state.checkpoint!;
    expect(savedCheckpoint).not.toBeNull();

    // Render unsafe consequence (open door)
    state = fireSpikeReducer(state, {
      type: "EXECUTE_INTERACTION",
      objectId: "bedroom-door",
      interaction: "open-door",
    });
    expect(state.doorOpen).toBe(true);
    expect(state.hazardExposure).toBeGreaterThan(40);

    // Restore checkpoint exactly
    state = fireSpikeReducer(state, { type: "RESTORE_CHECKPOINT" });

    // Verify restored state against saved snapshot
    const restoredCheckpoint: RendererCheckpoint = {
      playerPosition: [...state.playerPosition],
      playerYaw: state.playerYaw,
      playerPitch: state.playerPitch,
      crouched: state.crouched,
      doorOpen: state.doorOpen,
      smokeDensity: state.smokeDensity,
      hallwayLightIntensity: state.hallwayLightIntensity,
      discoveredCueIds: [...state.discoveredCueIds],
      completedActionIds: [...state.completedActionIds],
      hazardExposure: state.hazardExposure,
    };

    expect(areCheckpointsEqual(savedCheckpoint, restoredCheckpoint)).toBe(true);
    expect(state.doorOpen).toBe(false);
  });

  it("produces identical state from identical action sequences within tolerance", () => {
    const runSequence = () => {
      let s = INITIAL_SPIKE_STATE;
      s = fireSpikeReducer(s, {
        type: "SET_PLAYER_TRANSFORM",
        position: [-0.5, 1.7, 0.5],
        yaw: 0.1,
        pitch: 0.0,
      });
      s = fireSpikeReducer(s, {
        type: "EXECUTE_INTERACTION",
        objectId: "smoke-alarm",
        interaction: "listen-alarm",
      });
      s = fireSpikeReducer(s, {
        type: "EXECUTE_INTERACTION",
        objectId: "bedroom-door",
        interaction: "feel-door",
      });
      return s;
    };

    const run1 = runSequence();
    const run2 = runSequence();

    expect(run1.playerPosition).toEqual(run2.playerPosition);
    expect(run1.discoveredCueIds).toEqual(run2.discoveredCueIds);
    expect(run1.completedActionIds).toEqual(run2.completedActionIds);
    expect(run1.hazardExposure).toBe(run2.hazardExposure);
  });
});
