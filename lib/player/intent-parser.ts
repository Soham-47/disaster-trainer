import { resolveActionIntent, type ActionResolution } from "./action-resolver";
import type { EpisodeNode } from "@/lib/scenario/types";

export function parseIntent(node: EpisodeNode, command: string): ActionResolution {
  return resolveActionIntent(node, command);
}
