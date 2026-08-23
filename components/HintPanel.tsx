"use client";

import type { HintDefinition } from "@/lib/scenario/types";

type HintPanelProps = {
  hints: HintDefinition[];
  usedHintIds?: string[];
  disabled?: boolean;
  onRequest: (hint: HintDefinition) => void;
};

export function HintPanel({ hints, usedHintIds = [], disabled = false, onRequest }: HintPanelProps) {
  const nextHint = hints.find((hint) => !usedHintIds.includes(hint.id));
  if (!nextHint) return null;
  return (
    <button type="button" disabled={disabled} onClick={() => onRequest(nextHint)} className="shrink-0 rounded-full border border-sky-200/25 bg-sky-950/35 px-3 py-2 text-xs text-sky-100 transition hover:bg-sky-200/10 disabled:opacity-50">Hint · tier {nextHint.tier}</button>
  );
}
