import type { EpisodeGraph } from "./types";

export type EpisodeValidationResult = { valid: boolean; errors: string[] };

export function validateEpisodeGraph(graph: EpisodeGraph): EpisodeValidationResult {
  const errors: string[] = [];
  const nodeIds = new Set(Object.keys(graph.nodes));

  if (!graph.id) errors.push("episode id is required");
  if (!graph.version) errors.push("episode version is required");
  if (!nodeIds.has(graph.startNodeId)) {
    errors.push(`Start node ${graph.startNodeId} does not exist`);
  }
  if (!graph.transferEpisodeId) errors.push("transfer episode id is required");
  if (graph.sourceReferences.length === 0) errors.push("episode must contain an authoritative source");

  const cueIds = new Set(graph.cues.map((cue) => cue.id));
  const hintIds = new Set(graph.hints.map((hint) => hint.id));
  let hasMissingTransition = false;

  for (const node of Object.values(graph.nodes)) {
    if (!node.scene.referenceImage) errors.push(`Node ${node.id} is missing a reference image`);
    if (!node.scene.fallbackAsset) errors.push(`Node ${node.id} is missing a fallback asset`);

    for (const cueId of node.cueIds) {
      if (!cueIds.has(cueId)) errors.push(`Node ${node.id} references missing cue ${cueId}`);
    }
    for (const hintId of node.hintIds) {
      if (!hintIds.has(hintId)) errors.push(`Node ${node.id} references missing hint ${hintId}`);
    }
    for (const interaction of node.interactions) {
      if (!nodeIds.has(interaction.nextNodeId)) {
        errors.push(`Interaction ${interaction.id} points to missing node ${interaction.nextNodeId}`);
        hasMissingTransition = true;
      }
      if (interaction.aliases.length === 0) {
        errors.push(`Interaction ${interaction.id} must contain an alias`);
      }
    }
  }

  if (!hasMissingTransition && nodeIds.has(graph.startNodeId)) {
    const reachable = new Set<string>();
    const queue = [graph.startNodeId];
    while (queue.length > 0) {
      const nodeId = queue.shift();
      if (!nodeId || reachable.has(nodeId)) continue;
      reachable.add(nodeId);
      for (const interaction of graph.nodes[nodeId].interactions) {
        if (nodeIds.has(interaction.nextNodeId)) queue.push(interaction.nextNodeId);
      }
    }
    for (const nodeId of nodeIds) {
      if (!reachable.has(nodeId)) errors.push(`Node ${nodeId} is unreachable from start node ${graph.startNodeId}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
