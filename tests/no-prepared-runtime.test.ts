import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("primary runtime renderer", () => {
  it("contains no Happy Oyster or prepared media dependency", () => {
    const root = process.cwd();
    const page = fs.readFileSync(path.join(root, "app/page.tsx"), "utf8");
    const trainer = fs.readFileSync(path.join(root, "components/LingBotFireTrainer.tsx"), "utf8");
    const packageJson = fs.readFileSync(path.join(root, "package.json"), "utf8");
    expect(page + trainer + packageJson).not.toMatch(/HappyOyster|happy-oyster|fallbacks\//);
  });
});
