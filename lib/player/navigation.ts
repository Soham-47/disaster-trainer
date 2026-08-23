import type { WorldModelNavigationInput } from "@/lib/reactor/client";

export function navigationFromKeys(keys: Set<string>): WorldModelNavigationInput {
  return {
    forward: keys.has("w") || keys.has("W"),
    backward: keys.has("s") || keys.has("S"),
    left: keys.has("a") || keys.has("A"),
    right: keys.has("d") || keys.has("D"),
    lookHorizontal: keys.has("ArrowLeft") ? "left" : keys.has("ArrowRight") ? "right" : "idle",
    lookVertical: keys.has("ArrowUp") ? "up" : keys.has("ArrowDown") ? "down" : "idle",
  };
}

export const idleNavigation: WorldModelNavigationInput = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  lookHorizontal: "idle",
  lookVertical: "idle",
};
