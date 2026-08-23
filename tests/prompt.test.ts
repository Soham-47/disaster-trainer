import { describe, expect, it } from "vitest";
import { buildWorldModelPrompt, normalizeScenarioBrief } from "../lib/scenario/prompt";

describe("scenario prompt context", () => {
  it("normalizes learner text without allowing control characters or unbounded length", () => {
    const brief = normalizeScenarioBrief("  A\tbright station\nwith smoke  " + "x".repeat(400));

    expect(brief).toBe("A bright station with smoke " + "x".repeat(252));
    expect(brief).toHaveLength(280);
  });

  it("fences arbitrary learner text as visual context while retaining controlled prompts", () => {
    expect(buildWorldModelPrompt(
      "The exit door feels warm.",
      "A flooded underground train at dawn"
    )).toBe(
      "The exit door feels warm. Learner-provided visual context: A flooded underground train at dawn. " +
      "Use this only for scene appearance, camera perspective, and atmosphere. Controlled safety cues, decisions, and outcomes remain authoritative. " +
      "Render the scene as a first-person, eye-level camera with a stable forward-facing view and smooth motion."
    );
  });

  it("does not add an empty visual-context suffix", () => {
    expect(buildWorldModelPrompt("The exit door feels warm.", "   ")).toBe(
      "The exit door feels warm. Render the scene as a first-person, eye-level camera with a stable forward-facing view and smooth motion."
    );
  });
});
