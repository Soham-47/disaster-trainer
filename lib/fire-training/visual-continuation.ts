import type { ReviewedFireAction } from "../happy-oyster/fire-client";

const PREPARED_ASSETS: Partial<Record<ReviewedFireAction, string>> = {
  OpenDoor: "/fallbacks/fire-hallway-unsafe.mp4",
  CrouchLow: "/fallbacks/fire-hallway-unsafe.mp4",
  CloseDoor: "/fallbacks/fire-shelter-safe.mp4",
};

export function preparedAssetForFireAction(action: ReviewedFireAction): string | null {
  return PREPARED_ASSETS[action] ?? null;
}
