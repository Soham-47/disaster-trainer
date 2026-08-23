import { useEffect } from "react";

type RewindTransitionProps = {
  reducedMotion: boolean;
  onComplete: () => void;
};

export function RewindTransition({ reducedMotion, onComplete }: RewindTransitionProps) {
  useEffect(() => {
    const timeout = window.setTimeout(onComplete, reducedMotion ? 80 : 2200);
    return () => window.clearTimeout(timeout);
  }, [onComplete, reducedMotion]);

  return (
    <section aria-live="assertive" className={`rounded-2xl border border-purple-400/40 bg-purple-950/90 p-8 text-center shadow-2xl ${reducedMotion ? "" : "animate-pulse"}`}>
      <p className="text-xs font-mono uppercase tracking-[0.3em] text-purple-200">Rewind</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">Same warning. Different choice.</h2>
      <p className="mt-3 text-sm text-purple-100/80">Returning to the decision context…</p>
    </section>
  );
}

