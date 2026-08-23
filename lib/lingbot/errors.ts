export class LingBotTimeoutError extends Error {
  readonly code = "LINGBOT_TIMEOUT";

  constructor(readonly operation: string, readonly timeoutMs: number) {
    super(`Timed out waiting for ${operation} after ${timeoutMs}ms`);
    this.name = "LingBotTimeoutError";
  }
}

export class LingBotCommandError extends Error {
  readonly code = "LINGBOT_COMMAND_ERROR";

  constructor(readonly command: string, readonly reason: string) {
    super(`LingBot command ${command} failed: ${reason}`);
    this.name = "LingBotCommandError";
  }
}

export class LingBotTransportError extends Error {
  readonly code = "LINGBOT_TRANSPORT_ERROR";

  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "LingBotTransportError";
  }
}
