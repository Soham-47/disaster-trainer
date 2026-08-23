"use client";

import type { ActionIntent, InteractionDefinition } from "@/lib/scenario/types";

type ActionWheelProps = {
  interactions: InteractionDefinition[];
  disabled?: boolean;
  onSelect: (intent: ActionIntent, interaction: InteractionDefinition) => void;
};

export function ActionWheel({ interactions, disabled = false, onSelect }: ActionWheelProps) {
  if (interactions.length === 0) return null;
  return (
    <div aria-label="Available actions" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {interactions.map((interaction) => (
        <button
          key={interaction.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect({ verb: interaction.verb, targetId: interaction.targetId, toolId: interaction.toolId, source: "action-wheel" }, interaction)}
          className="rounded-xl border border-white/15 bg-black/50 px-4 py-3 text-left text-sm text-white transition hover:border-amber-300/70 hover:bg-amber-300/10 focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="block text-[10px] font-mono uppercase tracking-[0.2em] text-amber-300">{interaction.verb}</span>
          <span className="mt-1 block font-semibold">{interaction.label}</span>
        </button>
      ))}
    </div>
  );
}
