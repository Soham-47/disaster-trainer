import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["node_modules/**", "tests/e2e/**"],
    maxWorkers: 1,
    minWorkers: 1,
  },
});
