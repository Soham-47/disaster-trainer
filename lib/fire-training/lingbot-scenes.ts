import type { FireAction } from "./actions";
import type { LingBotSceneContract } from "../lingbot/types";

const invariantPrompt = "First-person view from inside the same compact apartment bedroom at night. Preserve the exact door position, bed, window, wall colors, lighting, camera height and room geometry from the reference image. The learner remains inside the bedroom. Photorealistic stable geometry, continuous shot. Before an explicit learner action is selected, the bedroom door is a fully closed, stationary barrier: walking toward it or looking at it is not an action and must never open, swing, bang, bounce, or animate the door. Only the reviewed OpenDoor action may open it, and only the reviewed CloseDoor action may close it. No people, captions or readable text, signs, additional doors or exits, additional rooms, camera cuts, invented actions, or model-generated safety advice.";
const forbiddenVisualFacts = ["people", "captions or readable text", "additional doors or exits", "model-generated safety advice"];

function scene(id: string, seed: number, branchPrompt: string, settledPrompt?: string): LingBotSceneContract {
  return { id, seed, invariantPrompt, branchPrompt, settledPrompt, requiredVisualFacts: ["same bedroom geometry", "same learner viewpoint"], forbiddenVisualFacts, cameraPose: [], attentionWindow: "small", maximumFirstFrameMs: 60_000 };
}

export const FIRE_INITIAL_SCENE = scene("fire-bedroom-initial", 42069, "Pre-decision state: a closed bedroom door is ahead, smoke enters only beneath its gap, and a window remains on the right. The door does not open before the learner chooses OpenDoor; it remains stationary while the learner walks, looks, listens, inspects, or feels it. Do not show flames in the bedroom or through the closed door. Hold this exact setup consistently.", "Keep the pre-decision door fully closed and motionless until an explicit reviewed action is selected.");
export const FIRE_UNSAFE_SCENE = scene("fire-door-open", 77117, "The learner selected OpenDoor. Perform exactly one controlled inward hinge movement from closed to open, then stop. Through the open doorway reveal a hot hallway with dense dark smoke, intense orange heat glow, and visible orange flames beyond the doorway. Visibility worsens quickly. The learner remains inside the bedroom and does not cross the doorway. Never swing, bounce, bang, or auto-close the door. Hold this consequence consistently.", "After the single opening movement, the door remains fully open and motionless. Keep visible flames beyond the doorway and do not allow banging, swinging, bouncing, animation, or any further door-state change.");
export const FIRE_SAFE_SCENE = scene("fire-door-closed", 77117, "The learner selected KeepDoorClosed. The bedroom door visibly remains fully closed in the same position. Smoke stays concentrated beneath the door gap instead of filling the room. No flames are visible inside the bedroom. The learner remains inside near the window while communicating and signaling for help. Do not open, swing, bang, or animate the door. Hold this consequence consistently.", "The door remains fully closed and stationary. Do not open, close, swing, bang, or animate it.");
export const FIRE_RECOVERY_SCENE = scene("fire-door-reclosed", 77118, "The learner selected CloseDoor. Perform exactly one controlled closing movement from the smoke-exposed open position, then stop fully closed. Smoke already admitted remains in the room but no additional hallway smoke enters. The learner remains low inside the bedroom. Preserve the same geometry and camera position. Never swing, bounce, bang, or reopen the door. Hold the recovered barrier consistently.", "After the single closing movement, the door remains fully closed and motionless. Do not reopen, swing, bang, bounce, animate, or change its state again.");

export function sceneForFireAction(action: FireAction): LingBotSceneContract {
  switch (action) {
    case "OpenDoor": return FIRE_UNSAFE_SCENE;
    case "KeepDoorClosed": return FIRE_SAFE_SCENE;
    case "CloseDoor": return FIRE_RECOVERY_SCENE;
    default: return FIRE_INITIAL_SCENE;
  }
}
