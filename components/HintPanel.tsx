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
    <div className="rounded-xl border border-sky-300/20 bg-sky-950/30 p-3 backdrop-blur">
      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-sky-200">Need a nudge?</p>
      <button type="button" disabled={disabled} onClick={() => onRequest(nextHint)} className="mt-2 w-full rounded-lg border border-sky-200/30 px-3 py-2 text-left text-xs text-sky-50 transition hover:bg-sky-200/10 disabled:opacity-50">Reveal tier {nextHint.tier} hint</button>
    </div>
  );
}
