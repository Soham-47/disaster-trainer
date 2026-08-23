import { FireObjectId, FireInteraction, InteractiveObjectSpec } from "./types";

export const INTERACTIVE_OBJECTS: Record<FireObjectId, InteractiveObjectSpec> = {
  "smoke-alarm": {
    id: "smoke-alarm",
    name: "Smoke Alarm",
    position: [0, 2.7, 0],
    interactionDistance: 2.0,
    interaction: "listen-alarm",
    promptText: "[E] Listen to Smoke Alarm",
    description: "Smoke alarm emitting high-pitched warning beep near ceiling.",
  },
  "smoke-under-door": {
    id: "smoke-under-door",
    name: "Smoke Under Door",
    position: [0, 0.05, -2.3],
    interactionDistance: 2.0,
    interaction: "inspect-smoke",
    promptText: "[E] Inspect Smoke at Door Base",
    description: "Gray smoke visibly drifting beneath the door gap.",
  },
  "bedroom-door": {
    id: "bedroom-door",
    name: "Bedroom Door",
    position: [0, 1.2, -2.45],
    interactionDistance: 2.0,
    interaction: "feel-door",
    promptText: "[E] Feel Bedroom Door for Heat",
    description: "Closed wooden exit door leading to the hallway.",
  },
  "phone": {
    id: "phone",
    name: "Emergency Phone",
    position: [-0.5, 0.72, 1.8],
    interactionDistance: 2.0,
    interaction: "use-phone",
    promptText: "[E] Call 911 on Emergency Phone",
    description: "Smartphone on nightstand.",
  },
  "window": {
    id: "window",
    name: "Bedroom Window",
    position: [2.95, 1.4, 0],
    interactionDistance: 2.0,
    interaction: "signal-window",
    promptText: "[E] Wave Bright Cloth out Window",
    description: "Glass window looking out to the street.",
  },
  "flashlight": {
    id: "flashlight",
    name: "Flashlight",
    position: [-0.3, 0.72, 1.8],
    interactionDistance: 2.0,
    interaction: "crouch-low",
    promptText: "[E] Pickup Flashlight & Stay Low",
    description: "Tactical LED flashlight on nightstand.",
  },
  "signal-cloth": {
    id: "signal-cloth",
    name: "Bright Signal Cloth",
    position: [-1.5, 0.82, 0.5],
    interactionDistance: 2.0,
    interaction: "signal-window",
    promptText: "[E] Grab Bright Cloth for Window Signal",
    description: "Bright yellow/red emergency signaling towel on bed.",
  },
};

/**
 * Returns object nearest to camera reticle within maximum interaction distance (2.0m).
 */
export function getTargetInteractiveObject(
  cameraPos: [number, number, number],
  cameraDir: [number, number, number],
  objects: InteractiveObjectSpec[] = Object.values(INTERACTIVE_OBJECTS)
): InteractiveObjectSpec | null {
  let nearestObj: InteractiveObjectSpec | null = null;
  let minDistance = 2.0; // 2 m max interaction distance per plan spec

  for (const obj of objects) {
    const dx = obj.position[0] - cameraPos[0];
    const dy = obj.position[1] - cameraPos[1];
    const dz = obj.position[2] - cameraPos[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist <= obj.interactionDistance && dist < minDistance) {
      // Check alignment with look vector
      const objDir = [dx / dist, dy / dist, dz / dist];
      const dot = objDir[0] * cameraDir[0] + objDir[1] * cameraDir[1] + objDir[2] * cameraDir[2];

      if (dot > 0.6) {
        // Within cone of reticle raycast
        minDistance = dist;
        nearestObj = obj;
      }
    }
  }

  return nearestObj;
}
