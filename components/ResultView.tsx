type ResultViewProps = {
  initialChoiceLabel: string;
  transferChoiceLabel: string;
  generationMode: "live" | "fallback";
  onRestart: () => void;
};

export function ResultView({ initialChoiceLabel, transferChoiceLabel, generationMode, onRestart }: ResultViewProps) {
  const scored = generationMode === "live";
  return (
    <section aria-labelledby="result-heading" className="rounded-2xl border border-neutral-700 bg-neutral-950/95 p-6 text-center shadow-2xl backdrop-blur">
      <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-neutral-400">Session complete</p>
      <h2 id="result-heading" className="mt-2 text-2xl font-semibold text-white">You saw both futures.</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-neutral-300">Initial choice: <span className="text-white">{initialChoiceLabel}</span><br />Transfer choice: <span className="text-white">{transferChoiceLabel}</span></p>
      <p className={`mt-5 text-sm ${scored ? "text-emerald-300" : "text-amber-300"}`}>
        {scored ? "Live generation run recorded for the prototype." : "Prepared continuation used; this run is not scored."}
      </p>
      <button type="button" onClick={onRestart} className="mt-6 rounded-xl border border-neutral-600 px-5 py-3 text-sm font-semibold text-neutral-100 transition hover:border-neutral-400 hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-200">
        Run it again
      </button>
    </section>
  );
}

