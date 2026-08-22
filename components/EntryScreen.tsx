type EntryScreenProps = { onStart: () => void };

export function EntryScreen({ onStart }: EntryScreenProps) {
  return (
    <section className="max-w-3xl mx-auto rounded-3xl border border-neutral-800 bg-neutral-900/85 p-8 md:p-12 text-center shadow-2xl">
      <p className="text-xs font-mono uppercase tracking-[0.3em] text-amber-300">Guided preparedness practice</p>
      <h1 className="mt-4 text-4xl md:text-6xl font-semibold tracking-tight text-white">
        See the choice. Then see the other future.
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-neutral-300">
        Enter a short generated disaster situation, make one constrained decision, experience its consequence, rewind, and test what you learned in a new setting.
      </p>
      <button
        type="button"
        onClick={onStart}
        className="mt-8 rounded-xl bg-amber-400 px-6 py-3 text-sm font-bold text-neutral-950 shadow-lg shadow-amber-500/10 transition hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:ring-offset-2 focus:ring-offset-neutral-950"
      >
        Start featured scenario
      </button>
      <p className="mt-5 text-xs text-neutral-500">Experimental prototype · not certified emergency training</p>
    </section>
  );
}

