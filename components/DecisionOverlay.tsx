import type { ChoiceDefinition, DecisionTemplate } from "@/lib/scenario/types";

type DecisionOverlayProps = {
  decision: DecisionTemplate;
  onSelect: (choice: ChoiceDefinition) => void;
  disabled?: boolean;
};

export function DecisionOverlay({ decision, onSelect, disabled = false }: DecisionOverlayProps) {
  return (
    <section aria-labelledby="decision-heading" className="rounded-2xl border border-amber-400/30 bg-neutral-950/95 p-5 shadow-2xl backdrop-blur">
      <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-amber-300">Your decision</p>
      <h2 id="decision-heading" className="mt-2 text-xl font-semibold text-white">{decision.prompt}</h2>
      <div className="mt-5 grid gap-3">
        {decision.choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(choice)}
            className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-left text-sm text-neutral-100 transition hover:border-amber-300 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:cursor-wait disabled:opacity-60"
          >
            {choice.label}
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-neutral-500">Choose once. You will see both futures.</p>
    </section>
  );
}

