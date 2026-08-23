"use client";

import { useEffect, useRef } from "react";
import { idleNavigation, navigationFromKeys } from "../player/navigation";
import type { LingBotNavigationInput } from "./types";

export function useNavigationControls(enabled: boolean, sendNavigation: (input: LingBotNavigationInput) => void): void {
  const sendRef = useRef(sendNavigation);
  sendRef.current = sendNavigation;
  useEffect(() => {
    if (!enabled) return;
    const keys = new Set<string>();
    const allowed = new Set(["w", "a", "s", "d", "W", "A", "S", "D", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);
    const textEntry = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      return element?.tagName === "INPUT" || element?.tagName === "TEXTAREA" || element?.isContentEditable;
    };
    const update = () => sendRef.current(navigationFromKeys(keys));
    const clear = () => { keys.clear(); sendRef.current(idleNavigation); };
    const keyDown = (event: KeyboardEvent) => { if (!allowed.has(event.key) || textEntry(event.target)) return; event.preventDefault(); keys.add(event.key); update(); };
    const keyUp = (event: KeyboardEvent) => { if (!allowed.has(event.key)) return; keys.delete(event.key); update(); };
    window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp); window.addEventListener("blur", clear);
    return () => { window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); window.removeEventListener("blur", clear); clear(); };
  }, [enabled]);
}
