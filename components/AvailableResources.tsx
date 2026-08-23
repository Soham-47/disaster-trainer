"use client";

type AvailableResourcesProps = { resources: string[] };

export function AvailableResources({ resources }: AvailableResourcesProps) {
  return (
    <div aria-label="Available resources" className="flex min-w-0 items-center gap-2 text-xs text-neutral-400">
      <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.16em] text-neutral-500">Resources</span>
      <div className="flex min-w-0 flex-wrap gap-1">
        {resources.length === 0 ? <span>None</span> : resources.map((resource) => <span key={resource} className="rounded-full bg-white/10 px-2 py-1 text-neutral-200">{resource.replaceAll("-", " ")}</span>)}
      </div>
    </div>
  );
}
