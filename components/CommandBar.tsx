"use client";

import { FormEvent, useState } from "react";
import { parseIntent } from "@/lib/player/intent-parser";
import type { ActionIntent, EpisodeNode } from "@/lib/scenario/types";

type CommandBarProps = {
  node: EpisodeNode | null;
  disabled?: boolean;
  onIntent: (intent: ActionIntent) => void;
};

export function CommandBar({ node, disabled = false, onIntent }: CommandBarProps) {
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!node || !value.trim()) return;
    const result = parseIntent(node, value);
    if (result.kind === "match") {
      onIntent(result.intent);
      setValue("");
      setMessage(null);
      setSuggestions([]);
      return;
    }
    setMessage(result.kind === "unavailable" ? result.message : "Choose one of the available actions.");
    setSuggestions(result.kind === "ambiguous" ? result.suggestions : []);
  };

  const chooseSuggestion = (suggestion: string) => {
    if (!node) return;
    const result = parseIntent(node, suggestion);
    if (result.kind !== "match") return;
    onIntent(result.intent);
    setValue("");
    setMessage(null);
    setSuggestions([]);
  };

  return (
    <div className="w-full max-w-xl">
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor="simulation-command" className="sr-only">Describe an available action</label>
        <input
          id="simulation-command"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={disabled || !node}
          placeholder="Try: inspect the door"
          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/60 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-amber-300/70 focus:ring-2 focus:ring-amber-300/30 disabled:opacity-50"
        />
        <button type="submit" disabled={disabled || !node || !value.trim()} className="rounded-xl bg-amber-300 px-4 py-3 text-sm font-bold text-black transition hover:bg-amber-200 disabled:opacity-50">Act</button>
      </form>
      {message && <p className="mt-2 text-xs text-rose-200">{message}</p>}
      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button key={suggestion} type="button" onClick={() => chooseSuggestion(suggestion)} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-neutral-200 hover:border-amber-300/60 hover:text-white">{suggestion}</button>
          ))}
        </div>
      )}
    </div>
  );
}
