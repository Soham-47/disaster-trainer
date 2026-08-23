import type { ChoiceDefinition, GeneratedScenario } from "@/lib/scenario/types";

type TransferCheckProps = {
  scenario: GeneratedScenario;
  onSelect: (choice: ChoiceDefinition) => void;
  disabled?: boolean;
};

export function TransferCheck({ scenario, onSelect, disabled = false }: TransferCheckProps) {
  return (
    <section aria-labelledby="transfer-heading" className="rounded-2xl border border-sky-400/30 bg-neutral-950/95 p-5 shadow-2xl backdrop-blur">
      <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-sky-300">Transfer check · hotel room</p>
      <h2 id="transfer-heading" className="mt-2 text-xl font-semibold text-white">{scenario.decision.prompt}</h2>
      <p className="mt-3 text-sm text-neutral-300">The layout changed. The warning principle did not.</p>
      <div className="mt-5 grid gap-3">
        {scenario.decision.choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(choice)}
            className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-left text-sm text-neutral-100 transition hover:border-sky-300 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-wait disabled:opacity-60"
          >
            {choice.label}
          </button>
        ))}
      </div>
    </section>
  );
}

