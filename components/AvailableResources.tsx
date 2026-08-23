"use client";

type AvailableResourcesProps = { resources: string[] };

export function AvailableResources({ resources }: AvailableResourcesProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-md">
      <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-neutral-500">Available resources</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {resources.length === 0 ? <span className="text-xs text-neutral-400">None discovered yet</span> : resources.map((resource) => <span key={resource} className="rounded-full bg-white/10 px-2 py-1 text-xs text-neutral-200">{resource.replaceAll("-", " ")}</span>)}
      </div>
    </div>
  );
}
