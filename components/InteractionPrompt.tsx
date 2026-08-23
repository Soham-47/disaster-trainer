"use client";

import type { ActionIntent, InteractionDefinition } from "@/lib/scenario/types";

type InteractionPromptProps = {
  interaction: InteractionDefinition | null;
  disabled?: boolean;
  onActivate: (intent: ActionIntent, interaction: InteractionDefinition) => void;
};

export function InteractionPrompt({ interaction, disabled = false, onActivate }: InteractionPromptProps) {
  if (!interaction) return null;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onActivate({ verb: interaction.verb, targetId: interaction.targetId, toolId: interaction.toolId, source: "hotspot" }, interaction)}
      className="rounded-full border border-amber-200/70 bg-black/70 px-4 py-2 text-sm font-semibold text-white shadow-xl backdrop-blur transition hover:bg-amber-300 hover:text-black focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:opacity-50"
    >
      <span className="mr-2 text-amber-300">[E]</span>{interaction.label}
    </button>
  );
}
