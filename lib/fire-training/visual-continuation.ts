import type { FireAction } from "./actions";

const PREPARED_ASSETS: Partial<Record<FireAction, string>> = {
  OpenDoor: "/fallbacks/fire-hallway-unsafe.mp4",
  CrouchLow: "/fallbacks/fire-hallway-unsafe.mp4",
  CloseDoor: "/fallbacks/fire-shelter-safe.mp4",
};

export function preparedAssetForFireAction(action: FireAction): string | null {
  return PREPARED_ASSETS[action] ?? null;
}
