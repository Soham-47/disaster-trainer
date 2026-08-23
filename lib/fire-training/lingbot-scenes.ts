import type { FireAction } from "./actions";
import type { LingBotSceneContract } from "../lingbot/types";

const invariantPrompt = "First-person view from inside the same compact apartment bedroom at night. Preserve the exact door position, bed, window, wall colors, lighting, camera height and room geometry from the reference image. The learner remains inside the bedroom. Photorealistic stable geometry, continuous shot. No people, captions or readable text, signs, additional doors or exits, additional rooms, camera cuts, invented actions, or model-generated safety advice.";
const forbiddenVisualFacts = ["people", "captions or readable text", "additional doors or exits", "model-generated safety advice"];

function scene(id: string, seed: number, branchPrompt: string, settledPrompt?: string): LingBotSceneContract {
  return { id, seed, invariantPrompt, branchPrompt, settledPrompt, requiredVisualFacts: ["same bedroom geometry", "same learner viewpoint"], forbiddenVisualFacts, cameraPose: [], attentionWindow: "small", maximumFirstFrameMs: 60_000 };
}

export const FIRE_INITIAL_SCENE = scene("fire-bedroom-initial", 42069, "A closed bedroom door is ahead, smoke enters only beneath its gap, and a window remains on the right. Hold this exact setup consistently.");
export const FIRE_UNSAFE_SCENE = scene("fire-door-open", 77117, "The previously closed warm bedroom door is now visibly open inward. Dense dark smoke and intense orange hallway light enter through the opening. Visibility worsens quickly. The learner remains inside the bedroom and does not cross the doorway. Hold this consequence consistently.", "The door has completed one opening transition and remains fully open. Do not animate it again or change its state.");
export const FIRE_SAFE_SCENE = scene("fire-door-closed", 77117, "The bedroom door visibly remains fully closed in the same position. Smoke stays concentrated beneath the door gap instead of filling the room. The learner remains inside near the window while communicating and signaling for help. Hold this consequence consistently.", "The door remains fully closed and stationary. Do not open, close, or animate it.");
export const FIRE_RECOVERY_SCENE = scene("fire-door-reclosed", 77118, "From the same smoke-exposed bedroom, the previously opened bedroom door is now visibly closed again. Smoke already admitted remains in the room but no additional hallway smoke enters. The learner remains low inside the bedroom. Preserve the same geometry and camera position and hold the recovered barrier consistently.", "The door has completed one closing transition and remains fully closed. Do not animate it again or change its state.");

export function sceneForFireAction(action: FireAction): LingBotSceneContract {
  switch (action) {
    case "OpenDoor": return FIRE_UNSAFE_SCENE;
    case "KeepDoorClosed": return FIRE_SAFE_SCENE;
    case "CloseDoor": return FIRE_RECOVERY_SCENE;
    default: return FIRE_INITIAL_SCENE;
  }
}
