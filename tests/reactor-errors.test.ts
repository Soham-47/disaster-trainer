import { describe, expect, it } from "vitest";
import { formatReactorError } from "../lib/reactor/errors";

describe("Reactor error formatting", () => {
  it("preserves an object error message from the SDK", () => {
    expect(formatReactorError({ message: "Failed to create session: 429 no available capacity" })).toBe(
      "Failed to create session: 429 no available capacity"
    );
  });

  it("formats nested SDK errors without returning object coercion", () => {
    expect(formatReactorError({ error: { message: "no available servers" }, code: 429 })).toBe("no available servers");
    expect(formatReactorError({ code: 429, error: "no available capacity" })).toBe("no available capacity");
    expect(formatReactorError({ code: 429, reason: "capacity exhausted" })).toContain('"code":429');
  });

  it("keeps native Error and string messages concise", () => {
    expect(formatReactorError(new Error("connection closed"))).toBe("connection closed");
    expect(formatReactorError("connection closed")).toBe("connection closed");
  });
});

