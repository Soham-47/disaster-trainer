"use client";

import type { AssessmentEvent } from "@/lib/player/simulation-reducer";

type ScenarioTimelineProps = { events: AssessmentEvent[] };

export function ScenarioTimeline({ events }: ScenarioTimelineProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/50 p-3 backdrop-blur-md">
      <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-neutral-500">Decision timeline</p>
      <div className="mt-2 flex max-w-[min(70vw,560px)] gap-1.5 overflow-x-auto pb-1">
        {events.length === 0 ? <span className="text-xs text-neutral-400">Your actions will appear here.</span> : events.map((event) => <span key={`${event.kind}-${event.sequence}`} title={event.actionId ?? event.hintId ?? event.kind} className={`h-2.5 w-2.5 shrink-0 rounded-full ${event.safetyClass === "unsafe" ? "bg-rose-400" : event.kind === "hint" ? "bg-sky-300" : event.kind === "rewind" ? "bg-purple-300" : "bg-emerald-300"}`} />)}
      </div>
      {events.length > 0 && (
        <ol className="mt-2 max-h-20 space-y-1 overflow-y-auto border-t border-white/10 pt-2 text-[10px] text-neutral-400">
          {events.map((event) => <li key={`detail-${event.kind}-${event.sequence}`}><span className="mr-2 font-mono text-neutral-600">{String(event.sequence).padStart(2, "0")}</span>{event.kind === "action" ? `${event.actionId ?? "action"} · ${event.safetyClass ?? "conditional"}` : event.kind === "hint" ? `hint revealed · ${event.hintId}` : "checkpoint restored"}</li>)}
        </ol>
      )}
    </div>
  );
}
