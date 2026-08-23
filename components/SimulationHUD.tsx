"use client";

type SimulationHUDProps = {
  title: string;
  immediatePriority: string;
  hazardLevels: Record<string, number>;
  status: string;
  nodeIndex: number;
  nodeCount: number;
};

export function SimulationHUD({ title, immediatePriority, hazardLevels, status, nodeIndex, nodeCount }: SimulationHUDProps) {
  const exposure = Object.values(hazardLevels).reduce((total, value) => total + value, 0);
  const exposureLabel = exposure >= 7 ? "HIGH EXPOSURE" : exposure >= 3 ? "RISING EXPOSURE" : "LOW EXPOSURE";
  const exposureClass = exposure >= 7 ? "text-rose-300 border-rose-300/40 bg-rose-950/60" : exposure >= 3 ? "text-amber-200 border-amber-300/40 bg-amber-950/50" : "text-emerald-200 border-emerald-300/30 bg-emerald-950/40";

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-4 md:p-6">
      <div className="max-w-md rounded-2xl border border-white/10 bg-black/55 px-4 py-3 shadow-xl backdrop-blur-md">
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-amber-300">Immediate priority</p>
        <h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm leading-5 text-neutral-300">{immediatePriority}</p>
      </div>
      <div className="flex flex-col items-end gap-2 text-right">
        <span className={`rounded-full border px-3 py-1.5 text-[10px] font-mono tracking-[0.16em] ${exposureClass}`}>{exposureLabel}</span>
        <span className="rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.16em] text-neutral-300 backdrop-blur-md">{status} · {nodeIndex}/{nodeCount}</span>
      </div>
    </div>
  );
}
