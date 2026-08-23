import type { WorldModelAdapter } from "@/lib/reactor/client";

export async function playConsequence(adapter: WorldModelAdapter, prompt: string): Promise<void> {
  await adapter.applyPrompt(prompt);
}

export async function playAlternative(adapter: WorldModelAdapter, prompt: string): Promise<void> {
  await adapter.applyPrompt(prompt);
  await adapter.resume();
}
