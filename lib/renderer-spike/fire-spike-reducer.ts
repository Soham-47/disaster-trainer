import { FireSpikeState, FireObjectId, FireInteraction, RendererCheckpoint } from "./types";

export const INITIAL_PLAYER_POSITION: [number, number, number] = [0, 1.7, 1.0];
export const INITIAL_PLAYER_YAW = 0;
export const INITIAL_PLAYER_PITCH = 0;

export const INITIAL_SPIKE_STATE: FireSpikeState = {
  playerPosition: [...INITIAL_PLAYER_POSITION],
  playerYaw: INITIAL_PLAYER_YAW,
  playerPitch: INITIAL_PLAYER_PITCH,
  crouched: false,
  doorOpen: false,
  doorInspected: false,
  smokeDensity: 0.05,
  hallwayLightIntensity: 1.0,
  hazardExposure: 5,
  discoveredCueIds: [],
  completedActionIds: [],
  currentObjective: "Investigate smoke alarm sound and inspect bedroom exit door.",
  reducedMotion: false,
  checkpoint: null,
  activeAudioCaption: "[BEEP BEEP BEEP - Smoke Alarm Active]",
  audioPlaying: true,
  lastCapturedFrameUrl: null,
};

export type SpikeAction =
  | { type: "SET_PLAYER_TRANSFORM"; position: [number, number, number]; yaw: number; pitch: number }
  | { type: "TOGGLE_CROUCH" }
  | { type: "SET_CROUCH"; crouched: boolean }
  | { type: "EXECUTE_INTERACTION"; objectId: FireObjectId; interaction: FireInteraction }
  | { type: "SAVE_CHECKPOINT" }
  | { type: "RESTORE_CHECKPOINT" }
  | { type: "TOGGLE_REDUCED_MOTION" }
  | { type: "SET_AUDIO_CAPTION"; caption: string | null }
  | { type: "SET_CAPTURED_FRAME"; dataUrl: string }
  | { type: "RESET_SIMULATION" };

export function fireSpikeReducer(state: FireSpikeState, action: SpikeAction): FireSpikeState {
  switch (action.type) {
    case "SET_PLAYER_TRANSFORM": {
      return {
        ...state,
        playerPosition: action.position,
        playerYaw: action.yaw,
        playerPitch: action.pitch,
      };
    }

    case "TOGGLE_CROUCH": {
      const newCrouch = !state.crouched;
      const eyeHeight = newCrouch ? 1.05 : 1.7;
      const currentPos = state.playerPosition;
      return {
        ...state,
        crouched: newCrouch,
        playerPosition: [currentPos[0], eyeHeight, currentPos[2]],
        hazardExposure: newCrouch ? Math.max(0, state.hazardExposure - 2) : state.hazardExposure,
      };
    }

    case "SET_CROUCH": {
      const eyeHeight = action.crouched ? 1.05 : 1.7;
      const currentPos = state.playerPosition;
      return {
        ...state,
        crouched: action.crouched,
        playerPosition: [currentPos[0], eyeHeight, currentPos[2]],
      };
    }

    case "EXECUTE_INTERACTION": {
      const { objectId, interaction } = action;
      const discoveredCueIds = [...new Set([...state.discoveredCueIds, objectId])];
      const completedActionIds = [...new Set([...state.completedActionIds, interaction])];

      switch (interaction) {
        case "listen-alarm": {
          return {
            ...state,
            discoveredCueIds,
            completedActionIds,
            currentObjective: "Smoke alarm sounding. Check bedroom door before attempting to open.",
            activeAudioCaption: "[BEEP BEEP BEEP - Smoke Alarm loudest near ceiling]",
          };
        }

        case "inspect-smoke": {
          return {
            ...state,
            discoveredCueIds,
            completedActionIds,
            currentObjective: "Smoke seeping under door. Feel bedroom door for heat before opening!",
            activeAudioCaption: "[CRACKLE - Faint crackling sound heard behind door]",
          };
        }

        case "feel-door": {
          return {
            ...state,
            doorInspected: true,
            discoveredCueIds,
            completedActionIds,
            hallwayLightIntensity: 2.2,
            currentObjective: "CRITICAL CHOICE: Door feels extremely HOT! Decide: Open door (unsafe) or Keep door closed (safer).",
            activeAudioCaption: "[WARNING - Door surface radiates intense heat!]",
          };
        }

        case "open-door": {
          return {
            ...state,
            doorOpen: true,
            smokeDensity: 0.38,
            hallwayLightIntensity: 4.5,
            hazardExposure: Math.min(100, state.hazardExposure + 50),
            discoveredCueIds,
            completedActionIds,
            currentObjective: "UNSAFE ACTION EXECUTED! Superheated smoke & fire poured into room. Immediately close door or retreat!",
            activeAudioCaption: "[ROAR - Superheated smoke and flame burst into bedroom!]",
          };
        }

        case "keep-door-closed": {
          return {
            ...state,
            doorOpen: false,
            smokeDensity: 0.08,
            hallwayLightIntensity: 1.2,
            hazardExposure: Math.max(0, state.hazardExposure - 5),
            discoveredCueIds,
            completedActionIds,
            currentObjective: "SAFER ACTION EXECUTED! Door kept closed. Call 911 (phone) and signal at window with bright cloth.",
            activeAudioCaption: "[SAFE - Bedroom door sealed. Smoke ingress minimized.]",
          };
        }

        case "use-phone": {
          return {
            ...state,
            discoveredCueIds,
            completedActionIds,
            currentObjective: "911 Call dispatched! Report: Fire outside bedroom door. Move to window to signal rescuers.",
            activeAudioCaption: "[PHONE - '911, stay in room, seal bottom of door, signal at window!']",
          };
        }

        case "signal-window": {
          return {
            ...state,
            discoveredCueIds,
            completedActionIds,
            hazardExposure: Math.max(0, state.hazardExposure - 10),
            currentObjective: "SUCCESS: Rescuers spotted bright cloth signal! Fire department ladder en route.",
            activeAudioCaption: "[SIRENS - Fire trucks arriving outside window!]",
          };
        }

        case "crouch-low": {
          return fireSpikeReducer(state, { type: "TOGGLE_CROUCH" });
        }

        default:
          return state;
      }
    }

    case "SAVE_CHECKPOINT": {
      const checkpoint: RendererCheckpoint = {
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

      return {
        ...state,
        checkpoint,
        activeAudioCaption: "[CHECKPOINT SAVED - Exact renderer state captured]",
      };
    }

    case "RESTORE_CHECKPOINT": {
      if (!state.checkpoint) return state;
      const cp = state.checkpoint;
      return {
        ...state,
        playerPosition: [...cp.playerPosition],
        playerYaw: cp.playerYaw,
        playerPitch: cp.playerPitch,
        crouched: cp.crouched,
        doorOpen: cp.doorOpen,
        smokeDensity: cp.smokeDensity,
        hallwayLightIntensity: cp.hallwayLightIntensity,
        discoveredCueIds: [...cp.discoveredCueIds],
        completedActionIds: [...cp.completedActionIds],
        hazardExposure: cp.hazardExposure,
        doorInspected: true,
        currentObjective: "CHECKPOINT RESTORED: Evaluate alternative decision (Open Door vs Keep Door Closed).",
        activeAudioCaption: "[CHECKPOINT RESTORED - State perfectly restored]",
      };
    }

    case "TOGGLE_REDUCED_MOTION": {
      return {
        ...state,
        reducedMotion: !state.reducedMotion,
        activeAudioCaption: `[REDUCED MOTION: ${!state.reducedMotion ? "ON" : "OFF"}]`,
      };
    }

    case "SET_AUDIO_CAPTION": {
      return {
        ...state,
        activeAudioCaption: action.caption,
      };
    }

    case "SET_CAPTURED_FRAME": {
      return {
        ...state,
        lastCapturedFrameUrl: action.dataUrl,
        activeAudioCaption: "[FRAME CAPTURED - WebGL canvas frame serialized]",
      };
    }

    case "RESET_SIMULATION": {
      return {
        ...INITIAL_SPIKE_STATE,
      };
    }

    default:
      return state;
  }
}

export function areCheckpointsEqual(a: RendererCheckpoint, b: RendererCheckpoint): boolean {
  return (
    Math.abs(a.playerPosition[0] - b.playerPosition[0]) < 1e-4 &&
    Math.abs(a.playerPosition[1] - b.playerPosition[1]) < 1e-4 &&
    Math.abs(a.playerPosition[2] - b.playerPosition[2]) < 1e-4 &&
    Math.abs(a.playerYaw - b.playerYaw) < 1e-4 &&
    Math.abs(a.playerPitch - b.playerPitch) < 1e-4 &&
    a.crouched === b.crouched &&
    a.doorOpen === b.doorOpen &&
    Math.abs(a.smokeDensity - b.smokeDensity) < 1e-4 &&
    Math.abs(a.hallwayLightIntensity - b.hallwayLightIntensity) < 1e-4 &&
    a.hazardExposure === b.hazardExposure &&
    JSON.stringify(a.discoveredCueIds.sort()) === JSON.stringify(b.discoveredCueIds.sort()) &&
    JSON.stringify(a.completedActionIds.sort()) === JSON.stringify(b.completedActionIds.sort())
  );
}
