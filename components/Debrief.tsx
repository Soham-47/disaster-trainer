import type { GeneratedScenario } from "@/lib/scenario/types";

type DebriefProps = { scenario: GeneratedScenario; onContinue: () => void };

export function Debrief({ scenario, onContinue }: DebriefProps) {
  const { debrief } = scenario;
  return (
    <section aria-labelledby="debrief-heading" className="rounded-2xl border border-emerald-400/30 bg-neutral-950/95 p-5 shadow-2xl backdrop-blur">
      <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-emerald-300">Micro-debrief</p>
      <h2 id="debrief-heading" className="mt-2 text-xl font-semibold text-white">What the warning was telling you</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <article className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Warning cue</h3>
          <p className="mt-2 text-sm leading-6 text-neutral-200">{debrief.warningCue}</p>
        </article>
        <article className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Recommended response</h3>
          <p className="mt-2 text-sm leading-6 text-neutral-200">{debrief.recommendedAction}</p>
        </article>
        <article className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Why it matters</h3>
          <p className="mt-2 text-sm leading-6 text-neutral-200">{debrief.principle}</p>
        </article>
      </div>
      <a className="mt-4 inline-block text-xs text-emerald-300 underline underline-offset-4" href={debrief.source.url} target="_blank" rel="noreferrer">
        Source: {debrief.source.organization} · {debrief.source.title}
      </a>
      <button type="button" onClick={onContinue} className="mt-5 w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-neutral-950 transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200">
        Test the principle in a new setting
      </button>
    </section>
  );
}

