export type LingBotMetricStage = "token_requested" | "connected" | "image_accepted" | "prompt_accepted" | "generation_started" | "first_frame" | "checkpoint_uploaded" | "branch_requested" | "first_branch_chunk";
export type LingBotTimingMetrics = { stages: Partial<Record<LingBotMetricStage, number>> };

export function createTimingMetrics(): LingBotTimingMetrics { return { stages: {} }; }
export function recordStage(metrics: LingBotTimingMetrics, stage: LingBotMetricStage, at = Date.now()): LingBotTimingMetrics {
  return { stages: { ...metrics.stages, [stage]: at } };
}
export function durationBetween(metrics: LingBotTimingMetrics, from: LingBotMetricStage, to: LingBotMetricStage): number | null {
  const start = metrics.stages[from];
  const end = metrics.stages[to];
  return start === undefined || end === undefined ? null : Math.max(0, end - start);
}
