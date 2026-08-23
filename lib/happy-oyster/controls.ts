export type AdventureDirection =
  | "Front"
  | "Back"
  | "Left"
  | "Right"
  | "Front_Left"
  | "Front_Right"
  | "Back_Left"
  | "Back_Right";

export type AdventureLook =
  | "Mouse_Up"
  | "Mouse_Down"
  | "Mouse_Left"
  | "Mouse_Right"
  | "Mouse_Up_Left"
  | "Mouse_Up_Right"
  | "Mouse_Down_Left"
  | "Mouse_Down_Right";

export function directionFromKeys(keys: ReadonlySet<string>): AdventureDirection | null {
  const vertical = keys.has("w") === keys.has("s") ? "" : keys.has("w") ? "Front" : "Back";
  const horizontal = keys.has("a") === keys.has("d") ? "" : keys.has("a") ? "Left" : "Right";

  if (vertical && horizontal) return `${vertical}_${horizontal}` as AdventureDirection;
  return (vertical || horizontal || null) as AdventureDirection | null;
}

export function lookFromMouseDelta(dx: number, dy: number, threshold = 6): AdventureLook | null {
  const horizontal = Math.abs(dx) < threshold ? "" : dx < 0 ? "Left" : "Right";
  const vertical = Math.abs(dy) < threshold ? "" : dy < 0 ? "Up" : "Down";

  if (vertical && horizontal) return `Mouse_${vertical}_${horizontal}` as AdventureLook;
  if (vertical) return `Mouse_${vertical}` as AdventureLook;
  if (horizontal) return `Mouse_${horizontal}` as AdventureLook;
  return null;
}
