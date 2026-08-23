export const FIRE_ACTIONS = [
  "ListenAlarm",
  "InspectSmoke",
  "FeelDoor",
  "OpenDoor",
  "CloseDoor",
  "KeepDoorClosed",
  "UsePhone",
  "SignalWindow",
  "CrouchLow",
] as const;

export type FireAction = (typeof FIRE_ACTIONS)[number];

export function isFireAction(value: string): value is FireAction {
  return FIRE_ACTIONS.includes(value as FireAction);
}
