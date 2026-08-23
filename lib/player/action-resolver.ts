import type { ActionIntent, EpisodeNode, InteractionDefinition } from "@/lib/scenario/types";

export type ActionResolution =
  | { kind: "match"; intent: ActionIntent; interactionId: string }
  | { kind: "ambiguous"; suggestions: string[] }
  | { kind: "unavailable"; message: string };

export function normalizeActionText(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function actionIntent(interaction: InteractionDefinition): ActionIntent {
  return {
    verb: interaction.verb,
    targetId: interaction.targetId,
    ...(interaction.toolId ? { toolId: interaction.toolId } : {}),
    source: "text",
  };
}

export function resolveActionIntent(node: EpisodeNode, command: string): ActionResolution {
  const normalized = normalizeActionText(command);
  if (!normalized) return { kind: "unavailable", message: "Type an action to continue." };

  const exact = node.interactions.filter((interaction) => {
    const candidates = [interaction.label, ...interaction.aliases].map(normalizeActionText);
    return candidates.includes(normalized);
  });
  if (exact.length === 1) {
    return { kind: "match", intent: actionIntent(exact[0]), interactionId: exact[0].id };
  }
  if (exact.length > 1) {
    return { kind: "ambiguous", suggestions: exact.slice(0, 3).map((interaction) => interaction.label) };
  }

  const partial = node.interactions.filter((interaction) => {
    const candidates = [interaction.label, ...interaction.aliases].map(normalizeActionText);
    return candidates.some((candidate) => candidate.includes(normalized) || normalized.includes(candidate));
  });
  if (partial.length > 0) {
    return { kind: "ambiguous", suggestions: partial.slice(0, 3).map((interaction) => interaction.label) };
  }
  return { kind: "unavailable", message: "That action is not available here." };
}
