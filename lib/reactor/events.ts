export type ReactorEventType =
  | "image_accepted"
  | "prompt_accepted"
  | "conditions_ready"
  | "generation_started"
  | "chunk_complete"
  | "generation_paused"
  | "generation_resumed"
  | "command_error"
  | "status_change"
  | "frame_ready"
  | "fallback_triggered";

export type WorldModelStatus =
  | "idle"
  | "connecting"
  | "uploading_image"
  | "ready"
  | "generating"
  | "paused"
  | "fallback"
  | "error";

export interface ReactorEventPayloads {
  image_accepted: { referenceImage: string; timestamp: number };
  prompt_accepted: { prompt: string; timestamp: number };
  conditions_ready: { seed: number; timestamp: number };
  generation_started: { sessionId: string; mode: "live" | "fallback"; timestamp: number };
  chunk_complete: { chunkIndex: number; durationMs: number; timestamp: number };
  generation_paused: { capturedFrame?: string; timestamp: number };
  generation_resumed: { prompt?: string; timestamp: number };
  command_error: { code: string; message: string; fatal: boolean; timestamp: number };
  status_change: { status: WorldModelStatus; previousStatus: WorldModelStatus; timestamp: number };
  frame_ready: { frameUrl: string; width: number; height: number; timestamp: number };
  fallback_triggered: { reason: string; assetPath: string; timestamp: number };
}

export type ReactorEventListener<K extends ReactorEventType> = (
  payload: ReactorEventPayloads[K]
) => void;

export class ReactorEventEmitter {
  private listeners: Map<string, Set<Function>> = new Map();

  on<K extends ReactorEventType>(event: K, listener: ReactorEventListener<K>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    return () => {
      this.off(event, listener);
    };
  }

  off<K extends ReactorEventType>(event: K, listener: ReactorEventListener<K>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener);
    }
  }

  emit<K extends ReactorEventType>(event: K, payload: ReactorEventPayloads[K]): void {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach((listener) => {
        try {
          listener(payload);
        } catch (err) {
          console.error(`Error in Reactor event listener for ${event}:`, err);
        }
      });
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
