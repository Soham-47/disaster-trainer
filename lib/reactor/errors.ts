export function formatReactorError(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) return record.message;
    if (typeof record.error === "string" && record.error.trim()) return record.error;
    if (record.error && typeof record.error === "object") {
      const nested = formatReactorError(record.error);
      if (nested) return nested;
    }
    try {
      return JSON.stringify(error) || "Unknown Reactor error";
    } catch {
      return "Unknown Reactor error";
    }
  }
  return String(error);
}

