import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    restoreMocks: true,
    reporters: ["junit", "default"],
    setupFiles: ["src/testme/setup.ts"],
    // include: ["src/testme/*.test.ts?(x)"],
    outputFile: "coverage/junit.xml",
    coverage: {
      thresholds: {
        lines: 98,
        functions: 97,
        statements: 98,
        branches: 96,
      },
    },
  },
});