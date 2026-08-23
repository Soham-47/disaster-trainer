"use client";

export function LingBotDiagnostics({ phase, branchLatencyMs }: { phase: string; branchLatencyMs: number | null }) {
  return <aside data-testid="lingbot-diagnostics" className="rounded-lg border border-white/10 bg-black/70 px-3 py-2 text-[10px] font-mono text-neutral-300">phase={phase} · branch={branchLatencyMs === null ? "—" : `${branchLatencyMs}ms`}</aside>;
}
