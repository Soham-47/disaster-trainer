import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { getAllScenarioPacks } from "../lib/scenario/registry";
import { validateScenarioPack } from "../lib/scenario/validation";

describe("reviewed disaster packs", () => {
  it("validates every initial pack as playable", () => {
    const packs = getAllScenarioPacks();

    expect(packs).toHaveLength(5);
    for (const pack of packs) {
      expect(validateScenarioPack(pack)).toEqual({ valid: true, errors: [] });
      expect(pack.status).toBe("approved");
      expect(pack.sourceReferences[0]?.url).toMatch(/^https?:\/\//);
      expect(pack.decisions[0]?.choices).toHaveLength(2);
      expect(existsSync(resolve(process.cwd(), "public", pack.referenceImage.slice(1)))).toBe(true);
      expect(existsSync(resolve(process.cwd(), "public", pack.orientFallbackAsset.slice(1)))).toBe(true);
    }
  });

  it("keeps each disaster visually distinct", () => {
    const packs = getAllScenarioPacks();
    expect(new Set(packs.map((pack) => pack.referenceImage)).size).toBe(5);
    expect(new Set(packs.map((pack) => pack.basePrompt)).size).toBe(5);
    expect(new Set(packs.map((pack) => pack.orientFallbackAsset)).size).toBe(5);
  });
});
